import {
  TextCompileError,
  type TextComparator,
  type TextNameRef,
  type TextPathStep,
  type TextQueryNode,
  type TextQuerySyntax,
  type TextValue,
  type Token,
  type TokenKind
} from './entityQueryTextTypes';

type ParserState = {
  tokens: Token[];
  pos: number;
};

const peek = (state: ParserState): Token => state.tokens[state.pos]!;
const advance = (state: ParserState): Token => state.tokens[state.pos++]!;

const expect = (state: ParserState, kind: TokenKind): Token => {
  const token = peek(state);
  if (token.kind !== kind) {
    throw new TextCompileError(
      `Expected ${kind} but found '${token.text || '<eof>'}'`,
      token.offset
    );
  }
  return advance(state);
};

const nameRef = (token: Token): TextNameRef => ({
  value: (token.value ?? token.text).toString(),
  offset: token.offset
});

const parseWrapperCall = (state: ParserState): string => {
  expect(state, 'LPAREN');
  const value = expect(state, 'STRING').value as string;
  expect(state, 'RPAREN');
  return value;
};

const parseValue = (state: ParserState): TextValue => {
  const token = peek(state);
  if (token.kind === 'STRING') {
    advance(state);
    return { kind: 'literal', value: token.value as string, offset: token.offset };
  }
  if (token.kind === 'NUMBER') {
    advance(state);
    return { kind: 'literal', value: token.value as number, offset: token.offset };
  }
  if (token.kind === 'IDENT' && token.text === 'date') {
    advance(state);
    return { kind: 'date', value: parseWrapperCall(state), offset: token.offset };
  }
  if (token.kind === 'IDENT' && token.text === 'enumValue') {
    advance(state);
    return { kind: 'enumValue', value: parseWrapperCall(state), offset: token.offset };
  }
  if (token.kind === 'IDENT' && token.text === 'enumLabel') {
    advance(state);
    return { kind: 'enumLabel', value: parseWrapperCall(state), offset: token.offset };
  }
  if (token.kind === 'IDENT' && token.text === 'empty') {
    advance(state);
    return { kind: 'empty', offset: token.offset };
  }
  if (token.kind === 'IDENT' && token.text === 'not_empty') {
    advance(state);
    return { kind: 'notEmpty', offset: token.offset };
  }
  throw new TextCompileError(`Expected a value but found '${token.text || '<eof>'}'`, token.offset);
};

const parseFilter = (state: ParserState): TextQueryNode | undefined => {
  if (peek(state).kind !== 'LBRACKET') return undefined;
  advance(state);
  const filter = parseOrExpr(state);
  expect(state, 'RBRACKET');
  return filter;
};

const parseBackwardStep = (state: ParserState, arrow: Token): TextPathStep => {
  const first = peek(state);
  if (first.kind === 'STRING') {
    const schemaRef = nameRef(advance(state));
    if (peek(state).kind !== 'DOT') {
      return {
        kind: 'typedRelation',
        direction: 'out',
        relationRef: schemaRef,
        filter: parseFilter(state),
        offset: arrow.offset
      };
    }
    advance(state);
    const field = nameRef(expect(state, 'IDENT'));
    return {
      kind: 'backward',
      schemaRef,
      field,
      filter: parseFilter(state),
      offset: arrow.offset
    };
  }

  const firstIdent = nameRef(expect(state, 'IDENT'));
  if (peek(state).kind === 'DOT') {
    const save = state.pos;
    advance(state);
    if (peek(state).kind === 'IDENT') {
      const field = nameRef(advance(state));
      return {
        kind: 'backward',
        schemaRef: firstIdent,
        field,
        filter: parseFilter(state),
        offset: arrow.offset
      };
    }
    state.pos = save;
  }
  return {
    kind: 'backward',
    field: firstIdent,
    filter: parseFilter(state),
    offset: arrow.offset
  };
};

const parseStep = (state: ParserState): TextPathStep => {
  const token = peek(state);
  if (token.kind === 'ARROW') {
    const arrow = advance(state);
    if (arrow.text === '<-') return parseBackwardStep(state, arrow);
    const relationToken = peek(state);
    if (relationToken.kind !== 'STRING' && relationToken.kind !== 'IDENT') {
      throw new TextCompileError('Expected a relation schema after ->', relationToken.offset);
    }
    const relationRef = nameRef(advance(state));
    return {
      kind: 'typedRelation',
      direction: 'in',
      relationRef,
      filter: parseFilter(state),
      offset: arrow.offset
    };
  }

  const field = nameRef(expect(state, 'IDENT'));
  return { kind: 'field', field, filter: parseFilter(state), offset: token.offset };
};

const parsePathExpression = (state: ParserState): TextQueryNode => {
  const steps: TextPathStep[] = [parseStep(state)];
  while (peek(state).kind === 'DOT') {
    advance(state);
    steps.push(parseStep(state));
  }

  let comparator: TextComparator | undefined;
  let value: TextValue | undefined;
  if (peek(state).kind === 'COMPARATOR') {
    const comparatorToken = advance(state);
    comparator = { text: comparatorToken.text, offset: comparatorToken.offset };
    value = parseValue(state);
  }

  return {
    kind: 'path',
    steps,
    ...(comparator ? { comparator } : {}),
    ...(value ? { value } : {}),
    endOffset: peek(state).offset
  };
};

const tryParseSchemaPredicate = (state: ParserState): TextQueryNode | undefined => {
  const token = peek(state);
  if (token.kind !== 'IDENT' || token.text !== 'schema') return undefined;
  const save = state.pos;
  advance(state);
  const comparator = peek(state);
  if (comparator.kind !== 'COMPARATOR' || (comparator.text !== ':' && comparator.text !== '=')) {
    state.pos = save;
    return undefined;
  }
  advance(state);
  const refToken = peek(state);
  if (refToken.kind !== 'STRING' && refToken.kind !== 'IDENT') {
    throw new TextCompileError('Expected a schema name after schema:', refToken.offset);
  }
  const schemaRef = nameRef(advance(state));
  return { kind: 'schema', schemaRef, offset: token.offset };
};

const tryParseFreeTextPredicate = (state: ParserState): TextQueryNode | undefined => {
  const token = peek(state);
  if (token.kind !== 'IDENT' || token.text !== 'text') return undefined;
  const comparator = state.tokens[state.pos + 1];
  if (comparator?.kind !== 'COMPARATOR' || (comparator.text !== ':' && comparator.text !== '=')) {
    return undefined;
  }
  advance(state);
  advance(state);
  const valueToken = expect(state, 'STRING');
  return {
    kind: 'freeText',
    value: valueToken.value as string,
    offset: token.offset,
    valueOffset: valueToken.offset
  };
};

const parsePredicate = (state: ParserState): TextQueryNode => {
  const freeText = tryParseFreeTextPredicate(state);
  if (freeText) return freeText;
  const schema = tryParseSchemaPredicate(state);
  if (schema) return schema;
  return parsePathExpression(state);
};

const parseUnaryExpr = (state: ParserState): TextQueryNode => {
  if (peek(state).kind === 'NOT') {
    advance(state);
    return { kind: 'not', child: parseUnaryExpr(state) };
  }
  if (peek(state).kind === 'LPAREN') {
    advance(state);
    const node = parseOrExpr(state);
    expect(state, 'RPAREN');
    return node;
  }
  return parsePredicate(state);
};

const startsUnaryExpr = (token: Token): boolean =>
  token.kind === 'NOT' ||
  token.kind === 'LPAREN' ||
  token.kind === 'IDENT' ||
  token.kind === 'ARROW';

const parseAndExpr = (state: ParserState): TextQueryNode => {
  const children = [parseUnaryExpr(state)];
  for (;;) {
    if (peek(state).kind === 'AND') {
      advance(state);
      children.push(parseUnaryExpr(state));
      continue;
    }
    if (startsUnaryExpr(peek(state))) {
      children.push(parseUnaryExpr(state));
      continue;
    }
    break;
  }
  return children.length === 1 ? children[0]! : { kind: 'and', children };
};

const parseOrExpr = (state: ParserState): TextQueryNode => {
  const children = [parseAndExpr(state)];
  while (peek(state).kind === 'OR') {
    advance(state);
    children.push(parseAndExpr(state));
  }
  return children.length === 1 ? children[0]! : { kind: 'or', children };
};

const collectTopLevelSchemaRefs = (tokens: Token[]): TextNameRef[] => {
  const refs: TextNameRef[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind === 'LPAREN' || token.kind === 'LBRACKET') depth += 1;
    else if (token.kind === 'RPAREN' || token.kind === 'RBRACKET') depth -= 1;
    else if (depth === 0 && token.kind === 'IDENT' && token.text === 'schema') {
      const comparator = tokens[i + 1];
      const refToken = tokens[i + 2];
      if (
        comparator?.kind === 'COMPARATOR' &&
        (comparator.text === ':' || comparator.text === '=') &&
        refToken &&
        (refToken.kind === 'STRING' || refToken.kind === 'IDENT')
      ) {
        refs.push(nameRef(refToken));
      }
    }
  }
  return refs;
};

export const parseTextQuery = (tokens: Token[]): TextQuerySyntax => {
  const state: ParserState = { tokens, pos: 0 };
  const root = parseOrExpr(state);
  if (peek(state).kind !== 'EOF') {
    throw new TextCompileError(
      `Unexpected trailing input '${peek(state).text}'`,
      peek(state).offset
    );
  }
  return { root, topLevelSchemaRefs: collectTopLevelSchemaRefs(tokens) };
};
