import {
  TextCompileError,
  type TextCapture,
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
  // > 0 while parsing the `or_expr` of a `[...]` scope, so juxtaposition stops at a `columns`
  // sub-clause instead of consuming it as a predicate on a field named `columns`.
  scopeDepth: number;
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

// `now()` or `now(N)` — N (positive or negative) is the optional day offset.
const parseNowCall = (state: ParserState): number | undefined => {
  expect(state, 'LPAREN');
  if (peek(state).kind === 'RPAREN') {
    advance(state);
    return undefined;
  }
  const offsetDays = expect(state, 'NUMBER').value as number;
  expect(state, 'RPAREN');
  return offsetDays;
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
  if (token.kind === 'IDENT' && token.text === 'now') {
    advance(state);
    return { kind: 'now', offsetDays: parseNowCall(state), offset: token.offset };
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

type Scope = { filter?: TextQueryNode; captures?: TextCapture[] };

// `columns` / `chain` / `as` are contextual keywords: they only mean the clause / marker when the
// next token begins a capture path (an identifier or a traversal arrow). `columns = "x"` inside a
// bracket is still an ordinary predicate on a field literally named `columns`.
const nextBeginsCaptureStep = (state: ParserState, lookahead = 1): boolean => {
  const t = state.tokens[state.pos + lookahead];
  return t !== undefined && (t.kind === 'IDENT' || t.kind === 'ARROW');
};

const atColumnsClause = (state: ParserState): boolean => {
  const t = peek(state);
  return t.kind === 'IDENT' && t.text === 'columns' && nextBeginsCaptureStep(state);
};

const parseStepNoScope = (state: ParserState): TextPathStep => {
  const step = parseStep(state);
  if (step.filter || step.captures) {
    throw new TextCompileError(
      "A 'columns' capture path cannot contain a '[...]' scope",
      step.offset
    );
  }
  return step;
};

const parseCapture = (state: ParserState): TextCapture => {
  const start = peek(state);
  let chain = false;
  if (start.kind === 'IDENT' && start.text === 'chain' && nextBeginsCaptureStep(state)) {
    advance(state);
    chain = true;
  }
  const steps: TextPathStep[] = [parseStepNoScope(state)];
  while (peek(state).kind === 'DOT') {
    advance(state);
    steps.push(parseStepNoScope(state));
  }
  let alias: string | undefined;
  let aliasOffset: number | undefined;
  if (peek(state).kind === 'IDENT' && peek(state).text === 'as') {
    advance(state);
    const aliasToken = expect(state, 'STRING');
    alias = aliasToken.value as string;
    aliasOffset = aliasToken.offset;
  }
  return {
    chain,
    steps,
    ...(alias !== undefined ? { alias, aliasOffset } : {}),
    offset: start.offset
  };
};

const parseColumnsClause = (state: ParserState): TextCapture[] => {
  advance(state); // 'columns'
  const captures = [parseCapture(state)];
  while (peek(state).kind === 'COMMA') {
    advance(state);
    captures.push(parseCapture(state));
  }
  return captures;
};

const parseScope = (state: ParserState): Scope | undefined => {
  if (peek(state).kind !== 'LBRACKET') return undefined;
  advance(state);
  let filter: TextQueryNode | undefined;
  let captures: TextCapture[] | undefined;
  if (atColumnsClause(state)) {
    captures = parseColumnsClause(state);
  } else {
    state.scopeDepth += 1;
    filter = parseOrExpr(state);
    state.scopeDepth -= 1;
    if (atColumnsClause(state)) captures = parseColumnsClause(state);
  }
  expect(state, 'RBRACKET');
  return { filter, captures };
};

const applyScope = (step: TextPathStep, scope: Scope | undefined): TextPathStep => {
  if (!scope || (!scope.filter && !scope.captures)) return step;
  return {
    ...step,
    ...(scope.filter ? { filter: scope.filter } : {}),
    ...(scope.captures ? { captures: scope.captures } : {})
  };
};

const parseBackwardStep = (state: ParserState, arrow: Token): TextPathStep => {
  const first = peek(state);
  if (first.kind === 'STRING') {
    const schemaRef = nameRef(advance(state));
    if (peek(state).kind !== 'DOT') {
      return applyScope(
        {
          kind: 'typedRelation',
          direction: 'out',
          relationRef: schemaRef,
          offset: arrow.offset
        },
        parseScope(state)
      );
    }
    advance(state);
    const field = nameRef(expect(state, 'IDENT'));
    return applyScope(
      {
        kind: 'backward',
        schemaRef,
        field,
        offset: arrow.offset
      },
      parseScope(state)
    );
  }

  const firstIdent = nameRef(expect(state, 'IDENT'));
  if (peek(state).kind === 'DOT') {
    const save = state.pos;
    advance(state);
    if (peek(state).kind === 'IDENT') {
      const field = nameRef(advance(state));
      return applyScope(
        {
          kind: 'backward',
          schemaRef: firstIdent,
          field,
          offset: arrow.offset
        },
        parseScope(state)
      );
    }
    state.pos = save;
  }
  return applyScope(
    {
      kind: 'backward',
      field: firstIdent,
      offset: arrow.offset
    },
    parseScope(state)
  );
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
    return applyScope(
      {
        kind: 'typedRelation',
        direction: 'in',
        relationRef,
        offset: arrow.offset
      },
      parseScope(state)
    );
  }

  const field = nameRef(expect(state, 'IDENT'));
  return applyScope({ kind: 'field', field, offset: token.offset }, parseScope(state));
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
    if (state.scopeDepth > 0 && atColumnsClause(state)) break;
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
  const state: ParserState = { tokens, pos: 0, scopeDepth: 0 };
  const root = parseOrExpr(state);
  if (peek(state).kind !== 'EOF') {
    throw new TextCompileError(
      `Unexpected trailing input '${peek(state).text}'`,
      peek(state).offset
    );
  }
  return { root, topLevelSchemaRefs: collectTopLevelSchemaRefs(tokens) };
};
