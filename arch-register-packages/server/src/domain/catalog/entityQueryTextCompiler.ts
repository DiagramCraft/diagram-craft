import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type FilterOp,
  type PathStep,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  isReferenceOrContainmentField,
  type SchemaField,
  type TypedRelationField
} from '@arch-register/api-types/schemaContract';
import type {
  EntityRelationField,
  RelationField
} from '@arch-register/api-types/relationSchemaContract';
import { ASSESSMENT_FIELD_PREFIX } from '@arch-register/api-types/assessmentFilter';
import {
  relationFieldById,
  schemaFieldById,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRResolution';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

// Text ⇄ IR compiler for the entity query language (specs/QUERY_LANGUAGE.md §4). This file owns
// both directions: `parseEntityQueryText` (text -> IR) and `printEntityQueryText` (IR -> text).
// Scoped to text/IR only (#2329) — nothing here is wired into a search box or saved-view endpoint.

export type EnumCatalog = Map<string, WorkspaceEnumDbResult>;

export type TextParseError = { offset: number; message: string };

export type TextParseResult =
  | { ok: true; query: EntityQuery }
  | { ok: false; errors: TextParseError[] };

class TextCompileError extends Error {
  constructor(
    message: string,
    readonly offset: number
  ) {
    super(message);
  }
}

// ── Lexer ────────────────────────────────────────────────────────────────

type TokenKind =
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'DOT'
  | 'ARROW'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'COMPARATOR'
  | 'STRING'
  | 'NUMBER'
  | 'IDENT'
  | 'EOF';

type Token = { kind: TokenKind; text: string; value?: string | number; offset: number };

const COMPARATORS = ['!=', '^=', '$=', '>=', '<=', ':', '=', '~', '>', '<'] as const;

const isIdentStart = (ch: string) => /[A-Za-z_]/.test(ch);
const isIdentChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);

const readQuotedString = (input: string, start: number): { value: string; end: number } => {
  let out = '';
  let i = start + 1; // skip opening quote
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"') return { value: out, end: i + 1 };
    if (ch === '\\') {
      const next = input[i + 1];
      if (next === '"' || next === '\\') {
        out += next;
        i += 2;
        continue;
      }
      throw new TextCompileError(
        `Invalid escape sequence '\\${next ?? ''}' in quoted string — only \\" and \\\\ are valid`,
        i
      );
    }
    out += ch;
    i += 1;
  }
  throw new TextCompileError('Unterminated quoted string', start);
};

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const offset = i;
    if (ch === '(') {
      tokens.push({ kind: 'LPAREN', text: '(', offset });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'RPAREN', text: ')', offset });
      i += 1;
      continue;
    }
    if (ch === '[') {
      tokens.push({ kind: 'LBRACKET', text: '[', offset });
      i += 1;
      continue;
    }
    if (ch === ']') {
      tokens.push({ kind: 'RBRACKET', text: ']', offset });
      i += 1;
      continue;
    }
    if (ch === '.') {
      tokens.push({ kind: 'DOT', text: '.', offset });
      i += 1;
      continue;
    }
    if (ch === '<' && input[i + 1] === '-') {
      tokens.push({ kind: 'ARROW', text: '<-', offset });
      i += 2;
      continue;
    }
    if (ch === '-' && input[i + 1] === '>') {
      tokens.push({ kind: 'ARROW', text: '->', offset });
      i += 2;
      continue;
    }
    if (ch === '"') {
      const { value, end } = readQuotedString(input, i);
      tokens.push({ kind: 'STRING', text: input.slice(i, end), value, offset });
      i = end;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i + (ch === '-' ? 1 : 0);
      while (j < input.length && /[0-9]/.test(input[j]!)) j += 1;
      if (input[j] === '.' && /[0-9]/.test(input[j + 1] ?? '')) {
        j += 1;
        while (j < input.length && /[0-9]/.test(input[j]!)) j += 1;
      }
      const text = input.slice(i, j);
      tokens.push({ kind: 'NUMBER', text, value: Number(text), offset });
      i = j;
      continue;
    }
    const comparator = COMPARATORS.find(c => input.startsWith(c, i));
    if (comparator) {
      tokens.push({ kind: 'COMPARATOR', text: comparator, offset });
      i += comparator.length;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < input.length && isIdentChar(input[j]!)) j += 1;
      let text = input.slice(i, j);
      // `_assessment:<fieldId>` is a single field_id token (specs/QUERY_LANGUAGE.md §4.1) — the
      // only field_id shape containing ':', which otherwise tokenizes as a COMPARATOR.
      if (text === '_assessment' && input[j] === ':' && isIdentStart(input[j + 1] ?? '')) {
        let k = j + 1;
        while (k < input.length && isIdentChar(input[k]!)) k += 1;
        text = input.slice(i, k);
        j = k;
      }
      const kind: TokenKind =
        text === 'AND' ? 'AND' : text === 'OR' ? 'OR' : text === 'NOT' ? 'NOT' : 'IDENT';
      tokens.push({ kind, text, offset });
      i = j;
      continue;
    }
    throw new TextCompileError(`Unexpected character '${ch}'`, offset);
  }
  tokens.push({ kind: 'EOF', text: '', offset: input.length });
  return tokens;
};

// ── Parser state ─────────────────────────────────────────────────────────

type ParserState = {
  tokens: Token[];
  pos: number;
  hopsUsed: number;
  authCtx: WorkspaceAuthorizationContext | null;
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

// ── Schema/field resolution helpers ─────────────────────────────────────

const PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_lifecycle',
  '_owner',
  '_name',
  '_slug',
  '_description',
  '_namespace',
  '_completeness',
  '_updatedAt',
  '_tags',
  '_assessment'
]);

const isPseudoFieldId = (fieldId: string): boolean =>
  PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith(ASSESSMENT_FIELD_PREFIX);

const schemaNameMap = (schemas: SchemaCatalog): Map<string, string> => {
  const byName = new Map<string, string>();
  for (const schema of schemas.values()) byName.set(schema.name, schema.id);
  return byName;
};

const resolveSchemaRef = (schemas: SchemaCatalog, ref: string, offset: number): string => {
  const id = schemaNameMap(schemas).get(ref);
  if (!id) throw new TextCompileError(`Unknown schema '${ref}'`, offset);
  return id;
};

const schemaNameById = (schemas: SchemaCatalog, schemaId: string): string =>
  schemas.get(schemaId)?.name ?? schemaId;

type FieldResolution =
  | { kind: 'pseudo' }
  | { kind: 'scalar'; field: SchemaField }
  | { kind: 'relation'; field: Extract<SchemaField, { type: 'reference' | 'containment' }> }
  | {
      kind: 'typedRelation';
      field: TypedRelationField;
      relationSchemaId: string;
      ownerSchemaIds: string[];
    }
  | { kind: 'unboundTypedRelation'; relationSchemaId: string; direction: 'in' | 'out' }
  | { kind: 'relationScalar'; field: RelationField; relationSchemaId: string }
  // Relation -> entity via an entityRelation field (#2670) — used both for a bracket-scoped
  // forward hop off a relation's own field namespace (`flows_in[data._name = ...]`) and for the
  // top-level `<-RelationSchema.field` reverse form.
  | { kind: 'relationEntityRelation'; field: EntityRelationField; relationSchemaId: string }
  // `_in`/`_out` inside a relation-scoped bracket (#2670) — selects the relation instance's
  // fixed endpoint, mirroring the IR's `endpoint` PathStep.
  | { kind: 'endpointPseudo'; direction: 'in' | 'out' };

const relationSchemaNameById = (
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string
): string => relationSchemas.get(relationSchemaId)?.name ?? relationSchemaId;

const relationSchemaNameMap = (relationSchemas: RelationSchemaCatalog): Map<string, string> => {
  const byName = new Map<string, string>();
  for (const schema of relationSchemas.values()) byName.set(schema.name, schema.id);
  return byName;
};

const resolveRelationSchemaRef = (
  relationSchemas: RelationSchemaCatalog,
  ref: string,
  offset: number
): string => {
  if (relationSchemas.has(ref)) return ref;
  const id = relationSchemaNameMap(relationSchemas).get(ref);
  if (!id) throw new TextCompileError(`Unknown relation schema '${ref}'`, offset);
  return id;
};

// Resolves a plain (non-`<-`) field id against the known current schema, or — when the current
// schema isn't statically known (no leading `schema:`/prior hop yet, specs/QUERY_LANGUAGE.md §4.4)
// — against every schema in the catalog, requiring every match to agree on shape (and, for
// relations, target schema) before proceeding. Disagreement is a compile error asking the query to
// disambiguate with `schema:`.
const resolveField = (
  fieldId: string,
  currentSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): FieldResolution => {
  if (isPseudoFieldId(fieldId)) return { kind: 'pseudo' };

  const candidateSchemas = (
    currentSchemaId
      ? [schemas.get(currentSchemaId)].filter((s): s is NonNullable<typeof s> => s != null)
      : [...schemas.values()]
  ).filter(schema => !isFieldViewRestricted(authCtx, schema, fieldId));

  const matches = candidateSchemas
    .map(schema => schemaFieldById(schema, fieldId))
    .filter((f): f is SchemaField => f != null);

  if (matches.length === 0) {
    throw new TextCompileError(
      currentSchemaId
        ? `Schema '${schemaNameById(schemas, currentSchemaId)}' does not define field '${fieldId}'`
        : `Unknown field '${fieldId}'`,
      offset
    );
  }

  const relationMatches = matches.filter(isReferenceOrContainmentField);
  const typedRelationMatches = matches.filter(
    (field): field is TypedRelationField => field.type === 'typedRelation'
  );
  if (typedRelationMatches.length > 0) {
    if (typedRelationMatches.length !== matches.length) {
      throw new TextCompileError(
        `Field '${fieldId}' is a typed relation on some schemas and a scalar on others — use 'schema:' to disambiguate`,
        offset
      );
    }
    const bindings = new Set(
      typedRelationMatches.map(field => `${field.relationSchemaId}:${field.direction}`)
    );
    if (bindings.size > 1) {
      throw new TextCompileError(
        `Field '${fieldId}' binds different typed relations depending on the owning schema — use 'schema:' to disambiguate`,
        offset
      );
    }
    const field = typedRelationMatches[0]!;
    if (!relationSchemas.has(field.relationSchemaId)) {
      throw new TextCompileError(
        `Unknown relation schema '${field.relationSchemaId}' for field '${fieldId}'`,
        offset
      );
    }
    const ownerSchemaIds = candidateSchemas
      .filter(schema => {
        const candidate = schemaFieldById(schema, fieldId);
        return (
          candidate?.type === 'typedRelation' &&
          candidate.relationSchemaId === field.relationSchemaId &&
          candidate.direction === field.direction
        );
      })
      .map(schema => schema.id);
    return {
      kind: 'typedRelation',
      field,
      relationSchemaId: field.relationSchemaId,
      ownerSchemaIds
    };
  }
  if (relationMatches.length > 0) {
    if (relationMatches.length !== matches.length) {
      throw new TextCompileError(
        `Field '${fieldId}' is a relation on some schemas and a scalar on others — use 'schema:' to disambiguate`,
        offset
      );
    }
    const targets = new Set(relationMatches.map(f => f.schemaId));
    if (targets.size > 1) {
      throw new TextCompileError(
        `Field '${fieldId}' targets different schemas depending on the owning schema — use 'schema:' to disambiguate`,
        offset
      );
    }
    return { kind: 'relation', field: relationMatches[0]! };
  }

  const types = new Set(matches.map(f => f.type));
  if (types.size > 1) {
    throw new TextCompileError(
      `Field '${fieldId}' has different types across schemas — use 'schema:' to disambiguate`,
      offset
    );
  }
  return { kind: 'scalar', field: matches[0]! };
};

const resolveRelationField = (
  fieldId: string,
  relationSchemaId: string,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): FieldResolution => {
  const relationSchema = relationSchemas.get(relationSchemaId);
  const field = relationFieldById(relationSchema, fieldId);
  if (!relationSchema) {
    throw new TextCompileError(`Unknown relation schema '${relationSchemaId}'`, offset);
  }
  if (!field || isFieldViewRestricted(authCtx, relationSchema, fieldId)) {
    throw new TextCompileError(
      `Relation schema '${relationSchemaNameById(relationSchemas, relationSchemaId)}' does not define a viewable field '${fieldId}'`,
      offset
    );
  }
  if (field.type === 'entityRelation') {
    return { kind: 'relationEntityRelation', field, relationSchemaId };
  }
  return { kind: 'relationScalar', field, relationSchemaId };
};

type BackwardResolution =
  | { kind: 'backward'; ownerSchemaId: string }
  // Entity -> relation via another relation schema's entityRelation field (#2670) — the reverse
  // form of a `relationEntityRelation` field resolution.
  | { kind: 'relationBackward'; relationSchemaId: string; field: EntityRelationField };

// Resolves a `<-field_id` (bare) or `<-Schema.field_id` (explicit) backward step, returning
// either an entity-schema owner (reference/containment field) or a relation-schema owner
// (entityRelation field, #2670) and the resolved field. `Schema` in the explicit form is looked
// up against both registries — they occupy disjoint id/name spaces in practice, so a name
// collision between an entity schema and a relation schema is treated as an error asking the
// query to rename one, rather than silently picking one. Mirrors specs/QUERY_LANGUAGE.md §4.2.
const resolveBackwardStep = (
  fieldId: string,
  explicitSchemaRef: string | undefined,
  currentSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): BackwardResolution => {
  if (explicitSchemaRef) {
    const entitySchemaId = schemaNameMap(schemas).get(explicitSchemaRef);
    const relationSchemaId = relationSchemaNameMap(relationSchemas).get(explicitSchemaRef);
    if (entitySchemaId && relationSchemaId) {
      throw new TextCompileError(
        `'${explicitSchemaRef}' names both an entity schema and a relation schema — rename one to disambiguate`,
        offset
      );
    }
    if (relationSchemaId) {
      const relationSchema = relationSchemas.get(relationSchemaId)!;
      const field = relationFieldById(relationSchema, fieldId);
      if (
        field?.type !== 'entityRelation' ||
        isFieldViewRestricted(authCtx, relationSchema, fieldId)
      ) {
        throw new TextCompileError(
          `Relation schema '${explicitSchemaRef}' does not define a viewable entityRelation field '${fieldId}'`,
          offset
        );
      }
      if (currentSchemaId && field.schemaId !== currentSchemaId) {
        throw new TextCompileError(
          `'<-${explicitSchemaRef}.${fieldId}' does not point at '${schemaNameById(schemas, currentSchemaId)}'`,
          offset
        );
      }
      return { kind: 'relationBackward', relationSchemaId, field };
    }
    if (!entitySchemaId) {
      throw new TextCompileError(`Unknown schema '${explicitSchemaRef}'`, offset);
    }
    const owner = schemas.get(entitySchemaId)!;
    const field = schemaFieldById(owner, fieldId);
    if (
      !field ||
      !isReferenceOrContainmentField(field) ||
      isFieldViewRestricted(authCtx, owner, fieldId)
    ) {
      throw new TextCompileError(
        `Schema '${explicitSchemaRef}' does not define a reference/containment field '${fieldId}'`,
        offset
      );
    }
    if (currentSchemaId && field.schemaId !== currentSchemaId) {
      throw new TextCompileError(
        `'<-${explicitSchemaRef}.${fieldId}' does not point at '${schemaNameById(schemas, currentSchemaId)}'`,
        offset
      );
    }
    return { kind: 'backward', ownerSchemaId: entitySchemaId };
  }

  const entityCandidates = [...schemas.values()].filter(schema => {
    const field = schemaFieldById(schema, fieldId);
    if (!field || !isReferenceOrContainmentField(field)) return false;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) return false;
    return currentSchemaId ? field.schemaId === currentSchemaId : true;
  });
  const relationCandidates = [...relationSchemas.values()].filter(schema => {
    const field = relationFieldById(schema, fieldId);
    if (field?.type !== 'entityRelation') return false;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) return false;
    return currentSchemaId ? field.schemaId === currentSchemaId : true;
  });

  if (entityCandidates.length + relationCandidates.length === 0) {
    throw new TextCompileError(
      `No schema defines a reference/containment or entityRelation field '${fieldId}'`,
      offset
    );
  }
  if (entityCandidates.length + relationCandidates.length > 1) {
    const names = [...entityCandidates, ...relationCandidates].map(s => s.name).join(', ');
    throw new TextCompileError(
      `'<-${fieldId}' is ambiguous between: ${names} — disambiguate with '<-Schema.${fieldId}'`,
      offset
    );
  }
  if (entityCandidates.length === 1) {
    return { kind: 'backward', ownerSchemaId: entityCandidates[0]!.id };
  }
  const relationSchema = relationCandidates[0]!;
  const field = relationFieldById(relationSchema, fieldId) as EntityRelationField;
  return { kind: 'relationBackward', relationSchemaId: relationSchema.id, field };
};

// ── Value parsing ────────────────────────────────────────────────────────

type ParsedValue =
  | { kind: 'literal'; value: string | number }
  | { kind: 'date'; value: string }
  | { kind: 'enumValue'; value: string }
  | { kind: 'enumLabel'; value: string }
  | { kind: 'empty' }
  | { kind: 'notEmpty' };

const parseWrapperCall = (state: ParserState): string => {
  expect(state, 'LPAREN');
  const value = expect(state, 'STRING').value as string;
  expect(state, 'RPAREN');
  return value;
};

const parseValue = (state: ParserState): ParsedValue => {
  const token = peek(state);
  if (token.kind === 'STRING') {
    advance(state);
    return { kind: 'literal', value: token.value as string };
  }
  if (token.kind === 'NUMBER') {
    advance(state);
    return { kind: 'literal', value: token.value as number };
  }
  if (token.kind === 'IDENT' && token.text === 'date') {
    advance(state);
    return { kind: 'date', value: parseWrapperCall(state) };
  }
  if (token.kind === 'IDENT' && token.text === 'enumValue') {
    advance(state);
    return { kind: 'enumValue', value: parseWrapperCall(state) };
  }
  if (token.kind === 'IDENT' && token.text === 'enumLabel') {
    advance(state);
    return { kind: 'enumLabel', value: parseWrapperCall(state) };
  }
  if (token.kind === 'IDENT' && token.text === 'empty') {
    advance(state);
    return { kind: 'empty' };
  }
  if (token.kind === 'IDENT' && token.text === 'not_empty') {
    advance(state);
    return { kind: 'notEmpty' };
  }
  throw new TextCompileError(`Expected a value but found '${token.text || '<eof>'}'`, token.offset);
};

// Resolves a comparator token + parsed value against the terminal field's resolved shape into a
// concrete { op, value } pair, per specs/QUERY_LANGUAGE.md §4.1 (date(...)/enumValue/enumLabel
// wrappers resolved away, comparator meaning derived from field type for `:`/`=`/`<`/`>`).
const resolveOpAndValue = (
  comparatorToken: string,
  parsed: ParsedValue,
  resolution: FieldResolution,
  enums: EnumCatalog,
  offset: number
): { op: FilterOp; value: unknown } => {
  if (parsed.kind === 'empty' || parsed.kind === 'notEmpty') {
    if (comparatorToken !== ':' && comparatorToken !== '=') {
      throw new TextCompileError(
        `Comparator '${comparatorToken}' cannot be combined with '${parsed.kind === 'empty' ? 'empty' : 'not_empty'}'`,
        offset
      );
    }
    return { op: parsed.kind === 'empty' ? 'empty' : 'not_empty', value: null };
  }

  const isScalarLike = resolution.kind === 'scalar' || resolution.kind === 'relationScalar';
  const isSelectField = isScalarLike && resolution.field.type === 'select';
  const isDateField = isScalarLike && resolution.field.type === 'date';
  const isCurrencyField = isScalarLike && resolution.field.type === 'currency';

  if ((parsed.kind === 'enumValue' || parsed.kind === 'enumLabel') && !isSelectField) {
    throw new TextCompileError(
      `'${parsed.kind}(...)' is only valid against a select field`,
      offset
    );
  }

  let value: unknown;
  if (parsed.kind === 'date') {
    value = parsed.value;
  } else if (parsed.kind === 'enumValue') {
    value = parsed.value;
  } else if (parsed.kind === 'enumLabel') {
    const enumDef = enums.get(
      (resolution as { field: Extract<SchemaField | RelationField, { type: 'select' }> }).field
        .enumId
    );
    const option = enumDef?.options.find(o => o.label === parsed.value);
    if (!option) {
      throw new TextCompileError(`Unrecognized enum label '${parsed.value}'`, offset);
    }
    value = option.value;
  } else {
    value = parsed.value;
  }

  if (isSelectField && ['<', '>', '<=', '>='].includes(comparatorToken)) {
    throw new TextCompileError(
      `Comparator '${comparatorToken}' has no meaning against a select field`,
      offset
    );
  }

  if (
    isCurrencyField &&
    (parsed.kind === 'date' || parsed.kind === 'enumValue' || parsed.kind === 'enumLabel')
  ) {
    throw new TextCompileError(`Currency fields only support numeric amount comparisons`, offset);
  }

  let op: FilterOp;
  switch (comparatorToken) {
    case ':':
    case '=':
      op = isDateField ? 'on' : 'equals';
      break;
    case '!=':
      op = 'not_equals';
      break;
    case '~':
      op = 'contains';
      break;
    case '^=':
      op = 'starts_with';
      break;
    case '$=':
      op = 'ends_with';
      break;
    case '>':
      op = isDateField ? 'after' : 'gt';
      break;
    case '>=':
      op = 'gte';
      break;
    case '<':
      op = isDateField ? 'before' : 'lt';
      break;
    case '<=':
      op = 'lte';
      break;
    default:
      throw new TextCompileError(`Unknown comparator '${comparatorToken}'`, offset);
  }
  return { op, value };
};

// ── Path/predicate parsing ───────────────────────────────────────────────

type ParsedStep = {
  step: PathStep;
  fieldId: string;
  resolution: FieldResolution;
  nextSchemaId: string | undefined;
  // Set only when this step lands on a relation instance (relationBackward, or `_in`/`_out`
  // inside a relation-scoped bracket resolves back to entity so this stays undefined there) —
  // the counterpart to nextSchemaId for the entity side (#2670).
  nextRelationSchemaId: string | undefined;
};

const parseStep = (
  state: ParserState,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  enums: EnumCatalog
): ParsedStep => {
  const token = peek(state);
  if (currentRelationSchemaId) {
    // `_in`/`_out` select the relation instance's fixed endpoint (#2670) — a traversal token, not
    // a real relation field, so it's recognized before falling back to resolveRelationField.
    if (token.kind === 'IDENT' && (token.text === '_in' || token.text === '_out')) {
      advance(state);
      const direction = token.text === '_in' ? 'in' : 'out';
      const relationSchema = relationSchemas.get(currentRelationSchemaId);
      const targetSchemaIds =
        direction === 'in' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
      return {
        step: { kind: 'endpoint', direction },
        fieldId: token.text,
        resolution: { kind: 'endpointPseudo', direction },
        nextSchemaId: targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined,
        nextRelationSchemaId: undefined
      };
    }
    const fieldId = expect(state, 'IDENT').text;
    const resolution = resolveRelationField(
      fieldId,
      currentRelationSchemaId,
      relationSchemas,
      token.offset,
      state.authCtx
    );
    if (resolution.kind === 'relationEntityRelation') {
      return {
        step: { kind: 'relationForward', fieldId },
        fieldId,
        resolution,
        nextSchemaId: resolution.field.schemaId,
        nextRelationSchemaId: undefined
      };
    }
    return {
      step: { kind: 'forward', fieldId },
      fieldId,
      resolution,
      nextSchemaId: undefined,
      nextRelationSchemaId: undefined
    };
  }
  let fieldId: string;
  let backward = false;
  let explicitSchemaRef: string | undefined;

  if (token.kind === 'ARROW') {
    advance(state);
    if (token.text === '->') {
      const relationRefToken = peek(state);
      if (relationRefToken.kind !== 'STRING' && relationRefToken.kind !== 'IDENT') {
        throw new TextCompileError('Expected a relation schema after ->', relationRefToken.offset);
      }
      advance(state);
      const relationRef = (relationRefToken.value ?? relationRefToken.text).toString();
      const relationSchemaId = resolveRelationSchemaRef(
        relationSchemas,
        relationRef,
        relationRefToken.offset
      );
      const relationSchema = relationSchemas.get(relationSchemaId);
      const targetSchemaIds = relationSchema?.out_schema_ids;
      state.hopsUsed += 1;
      if (state.hopsUsed > MAX_PATH_HOPS) {
        throw new TextCompileError(`Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`, token.offset);
      }
      let filter: QueryNode | undefined;
      if (peek(state).kind === 'LBRACKET') {
        advance(state);
        filter = parseOrExpr(
          state,
          undefined,
          relationSchemaId,
          schemas,
          relationSchemas,
          enums,
          false
        );
        expect(state, 'RBRACKET');
      }
      return {
        step: {
          kind: 'unboundTypedRelation',
          relationSchemaId,
          direction: 'in',
          ...(filter ? { filter } : {})
        },
        fieldId: `->${relationRef}`,
        resolution: { kind: 'unboundTypedRelation', relationSchemaId, direction: 'in' },
        nextSchemaId:
          Array.isArray(targetSchemaIds) && targetSchemaIds.length === 1
            ? targetSchemaIds[0]
            : undefined,
        nextRelationSchemaId: undefined
      };
    }
    backward = true;
    if (peek(state).kind === 'STRING') {
      const schemaRefToken = advance(state);
      explicitSchemaRef = schemaRefToken.value as string;
      if (peek(state).kind !== 'DOT') {
        const relationSchemaId = resolveRelationSchemaRef(
          relationSchemas,
          explicitSchemaRef,
          schemaRefToken.offset
        );
        const relationSchema = relationSchemas.get(relationSchemaId);
        const targetSchemaIds = relationSchema?.in_schema_ids;
        state.hopsUsed += 1;
        if (state.hopsUsed > MAX_PATH_HOPS) {
          throw new TextCompileError(`Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`, token.offset);
        }
        let filter: QueryNode | undefined;
        if (peek(state).kind === 'LBRACKET') {
          advance(state);
          filter = parseOrExpr(
            state,
            undefined,
            relationSchemaId,
            schemas,
            relationSchemas,
            enums,
            false
          );
          expect(state, 'RBRACKET');
        }
        return {
          step: {
            kind: 'unboundTypedRelation',
            relationSchemaId,
            direction: 'out',
            ...(filter ? { filter } : {})
          },
          fieldId: `<-${explicitSchemaRef}`,
          resolution: { kind: 'unboundTypedRelation', relationSchemaId, direction: 'out' },
          nextSchemaId:
            Array.isArray(targetSchemaIds) && targetSchemaIds.length === 1
              ? targetSchemaIds[0]
              : undefined,
          nextRelationSchemaId: undefined
        };
      }
      // A quoted entity schema reference still uses the existing `<-"Schema Name".field_id`
      // backward-reference form.
      expect(state, 'DOT');
      fieldId = expect(state, 'IDENT').text;
    } else {
      const first = expect(state, 'IDENT');
      if (peek(state).kind === 'DOT') {
        // Lookahead: `<-Schema.field_id` — only treat the first identifier as a schema_ref if a
        // second identifier follows the dot (otherwise this dot belongs to the outer path, e.g.
        // `<-domain.<-Component...`, and this identifier IS the field_id).
        const save = state.pos;
        advance(state); // DOT
        if (peek(state).kind === 'IDENT') {
          explicitSchemaRef = first.text;
          fieldId = advance(state).text;
        } else {
          state.pos = save;
          fieldId = first.text;
        }
      } else {
        fieldId = first.text;
      }
    }
  } else {
    fieldId = expect(state, 'IDENT').text;
  }

  state.hopsUsed += 1;
  if (state.hopsUsed > MAX_PATH_HOPS) {
    throw new TextCompileError(`Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`, token.offset);
  }

  if (backward) {
    const backwardResolution = resolveBackwardStep(
      fieldId,
      explicitSchemaRef,
      currentSchemaId,
      schemas,
      relationSchemas,
      token.offset,
      state.authCtx
    );
    if (backwardResolution.kind === 'relationBackward') {
      const { relationSchemaId } = backwardResolution;
      let filter: QueryNode | undefined;
      if (peek(state).kind === 'LBRACKET') {
        advance(state);
        filter = parseOrExpr(
          state,
          undefined,
          relationSchemaId,
          schemas,
          relationSchemas,
          enums,
          false
        );
        expect(state, 'RBRACKET');
      }
      return {
        step: {
          kind: 'relationBackward',
          fieldId,
          relationSchemaId,
          ...(filter ? { filter } : {})
        },
        fieldId,
        resolution: {
          kind: 'relationEntityRelation',
          field: backwardResolution.field,
          relationSchemaId
        },
        nextSchemaId: undefined,
        nextRelationSchemaId: relationSchemaId
      };
    }
    const { ownerSchemaId } = backwardResolution;
    let filter: QueryNode | undefined;
    if (peek(state).kind === 'LBRACKET') {
      advance(state);
      filter = parseOrExpr(state, ownerSchemaId, undefined, schemas, relationSchemas, enums, false);
      expect(state, 'RBRACKET');
    }
    return {
      step: { kind: 'backward', fieldId, ownerSchemaId, ...(filter ? { filter } : {}) },
      fieldId,
      resolution: {
        kind: 'relation',
        field: schemaFieldById(schemas.get(ownerSchemaId), fieldId) as Extract<
          SchemaField,
          { type: 'reference' | 'containment' }
        >
      },
      nextSchemaId: ownerSchemaId,
      nextRelationSchemaId: undefined
    };
  }

  const resolution = resolveField(
    fieldId,
    currentSchemaId,
    schemas,
    relationSchemas,
    token.offset,
    state.authCtx
  );
  const nextSchemaId =
    resolution.kind === 'relation'
      ? resolution.field.schemaId
      : resolution.kind === 'typedRelation'
        ? (() => {
            const relationSchema = relationSchemas.get(resolution.relationSchemaId);
            const ids =
              resolution.field.direction === 'in'
                ? relationSchema?.out_schema_ids
                : relationSchema?.in_schema_ids;
            return ids?.length === 1 ? ids[0] : undefined;
          })()
        : currentSchemaId;

  let filter: QueryNode | undefined;
  if (peek(state).kind === 'LBRACKET') {
    if (resolution.kind !== 'relation' && resolution.kind !== 'typedRelation') {
      throw new TextCompileError(
        `'[...]' can only scope a relation field, not '${fieldId}'`,
        token.offset
      );
    }
    advance(state);
    if (resolution.kind === 'typedRelation') {
      filter = parseOrExpr(
        state,
        undefined,
        resolution.relationSchemaId,
        schemas,
        relationSchemas,
        enums,
        false
      );
    } else {
      filter = parseOrExpr(state, nextSchemaId, undefined, schemas, relationSchemas, enums, false);
    }
    expect(state, 'RBRACKET');
  }

  return {
    step:
      resolution.kind === 'typedRelation'
        ? {
            kind: 'typedRelation',
            fieldId,
            relationSchemaId: resolution.relationSchemaId,
            direction: resolution.field.direction,
            ownerSchemaIds: resolution.ownerSchemaIds,
            ...(filter ? { filter } : {})
          }
        : { kind: 'forward', fieldId, ...(filter ? { filter } : {}) },
    fieldId,
    resolution,
    nextSchemaId,
    nextRelationSchemaId: undefined
  };
};

// Parses `schema:<schema_ref>` as its own predicate form — a reserved pseudo-field, not an
// ordinary `value` (specs/QUERY_LANGUAGE.md §4.1/§4.4) — compiling to `_schemaId equals <id>`.
const tryParseSchemaPredicate = (
  state: ParserState,
  schemas: SchemaCatalog
): QueryNode | undefined => {
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
  let ref: string;
  if (refToken.kind === 'STRING') {
    advance(state);
    ref = refToken.value as string;
  } else if (refToken.kind === 'IDENT') {
    advance(state);
    ref = refToken.text;
  } else {
    throw new TextCompileError('Expected a schema name after schema:', refToken.offset);
  }
  const schemaId = resolveSchemaRef(schemas, ref, refToken.offset);
  return { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: schemaId };
};

// `text:<string>` is a root-entity search clause rather than a normal field predicate. It is
// deliberately rejected while parsing a relation's scoped filter so free-text search cannot
// accidentally change the meaning of a forward or backward traversal.
const tryParseFreeTextPredicate = (
  state: ParserState,
  allowFreeText: boolean
): QueryNode | undefined => {
  const token = peek(state);
  if (token.kind !== 'IDENT' || token.text !== 'text') return undefined;
  const comparator = state.tokens[state.pos + 1];
  if (comparator?.kind !== 'COMPARATOR' || (comparator.text !== ':' && comparator.text !== '=')) {
    return undefined;
  }
  if (!allowFreeText) {
    throw new TextCompileError(
      "'text' free-text search is only valid for the starting entity list",
      token.offset
    );
  }
  advance(state);
  advance(state);
  const valueToken = expect(state, 'STRING');
  const value = valueToken.value as string;
  if (value.trim() === '') {
    throw new TextCompileError('Free-text search value must not be empty', valueToken.offset);
  }
  return { kind: 'freeText', value };
};

const parsePredicate = (
  state: ParserState,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  enums: EnumCatalog,
  allowFreeText: boolean
): QueryNode => {
  const freeTextPredicate = currentRelationSchemaId
    ? undefined
    : tryParseFreeTextPredicate(state, allowFreeText);
  if (freeTextPredicate) return freeTextPredicate;
  const schemaPredicate = currentRelationSchemaId
    ? undefined
    : tryParseSchemaPredicate(state, schemas);
  if (schemaPredicate) return schemaPredicate;

  const steps: ParsedStep[] = [];
  let schemaIdCursor = currentSchemaId;
  let relationSchemaIdCursor = currentRelationSchemaId;
  for (;;) {
    const parsed = parseStep(
      state,
      schemaIdCursor,
      relationSchemaIdCursor,
      schemas,
      relationSchemas,
      enums
    );
    steps.push(parsed);
    schemaIdCursor = parsed.nextSchemaId;
    relationSchemaIdCursor = parsed.nextRelationSchemaId;
    if (peek(state).kind === 'DOT') {
      advance(state);
      continue;
    }
    break;
  }

  const last = steps[steps.length - 1]!;
  const comparatorToken = peek(state);
  const isRelationLikeTerminal =
    last.resolution.kind === 'relation' ||
    last.resolution.kind === 'typedRelation' ||
    last.resolution.kind === 'unboundTypedRelation' ||
    last.resolution.kind === 'relationEntityRelation' ||
    last.resolution.kind === 'endpointPseudo';

  if (comparatorToken.kind === 'COMPARATOR') {
    if (last.step.kind !== 'endpoint' && last.step.filter) {
      throw new TextCompileError(
        `'[...]' cannot be combined with a trailing comparator on the same segment`,
        comparatorToken.offset
      );
    }
    if (isRelationLikeTerminal) {
      throw new TextCompileError(
        `'${last.fieldId}' is a relation field — compare a scalar field reached through it, or use '[...]' to scope a relationExists`,
        comparatorToken.offset
      );
    }
    advance(state);
    const parsedValue = parseValue(state);
    const { op, value } = resolveOpAndValue(
      comparatorToken.text,
      parsedValue,
      last.resolution,
      enums,
      comparatorToken.offset
    );
    const path = steps.slice(0, -1).map(s => s.step);
    return { kind: 'predicate', path, fieldId: last.fieldId, op, value };
  }

  if (last.resolution.kind === 'endpointPseudo') {
    throw new TextCompileError(
      `'${last.fieldId}' must be followed by a field, e.g. '${last.fieldId}._id'`,
      peek(state).offset
    );
  }
  // Bare path: shorthand for not_empty on a scalar terminal, or `relationExists` on a relation
  // terminal (specs/QUERY_LANGUAGE.md §4.1 line 81, §5).
  if (isRelationLikeTerminal) {
    return { kind: 'relationExists', path: steps.map(s => s.step) };
  }
  const path = steps.slice(0, -1).map(s => s.step);
  return { kind: 'predicate', path, fieldId: last.fieldId, op: 'not_empty', value: null };
};

const parseUnaryExpr = (
  state: ParserState,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  enums: EnumCatalog,
  allowFreeText: boolean
): QueryNode => {
  if (peek(state).kind === 'NOT') {
    advance(state);
    return {
      kind: 'not',
      child: parseUnaryExpr(
        state,
        currentSchemaId,
        currentRelationSchemaId,
        schemas,
        relationSchemas,
        enums,
        allowFreeText
      )
    };
  }
  if (peek(state).kind === 'LPAREN') {
    advance(state);
    const node = parseOrExpr(
      state,
      currentSchemaId,
      currentRelationSchemaId,
      schemas,
      relationSchemas,
      enums,
      allowFreeText
    );
    expect(state, 'RPAREN');
    return node;
  }
  return parsePredicate(
    state,
    currentSchemaId,
    currentRelationSchemaId,
    schemas,
    relationSchemas,
    enums,
    allowFreeText
  );
};

const startsUnaryExpr = (token: Token): boolean =>
  token.kind === 'NOT' ||
  token.kind === 'LPAREN' ||
  token.kind === 'IDENT' ||
  token.kind === 'ARROW';

const parseAndExpr = (
  state: ParserState,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  enums: EnumCatalog,
  allowFreeText: boolean
): QueryNode => {
  const children = [
    parseUnaryExpr(
      state,
      currentSchemaId,
      currentRelationSchemaId,
      schemas,
      relationSchemas,
      enums,
      allowFreeText
    )
  ];
  for (;;) {
    if (peek(state).kind === 'AND') {
      advance(state);
      children.push(
        parseUnaryExpr(
          state,
          currentSchemaId,
          currentRelationSchemaId,
          schemas,
          relationSchemas,
          enums,
          allowFreeText
        )
      );
      continue;
    }
    if (startsUnaryExpr(peek(state))) {
      children.push(
        parseUnaryExpr(
          state,
          currentSchemaId,
          currentRelationSchemaId,
          schemas,
          relationSchemas,
          enums,
          allowFreeText
        )
      ); // implicit AND
      continue;
    }
    break;
  }
  return children.length === 1 ? children[0]! : { kind: 'and', children };
};

const parseOrExpr = (
  state: ParserState,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  enums: EnumCatalog,
  allowFreeText: boolean
): QueryNode => {
  const children = [
    parseAndExpr(
      state,
      currentSchemaId,
      currentRelationSchemaId,
      schemas,
      relationSchemas,
      enums,
      allowFreeText
    )
  ];
  while (peek(state).kind === 'OR') {
    advance(state);
    children.push(
      parseAndExpr(
        state,
        currentSchemaId,
        currentRelationSchemaId,
        schemas,
        relationSchemas,
        enums,
        allowFreeText
      )
    );
  }
  return children.length === 1 ? children[0]! : { kind: 'or', children };
};

// Prepass: finds a top-level `schema:<ref>` predicate (not nested inside `()`/`[...]`) so the main
// parse can resolve unqualified paths against a known starting schema (specs/QUERY_LANGUAGE.md
// §4.4). A `schema:` predicate inside a nested group only affects that group's own local
// resolution, handled by the recursive descent itself — this prepass only looks at depth 0.
const deriveRootSchemaId = (tokens: Token[], schemas: SchemaCatalog): string | undefined => {
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'LPAREN' || token.kind === 'LBRACKET') depth += 1;
    else if (token.kind === 'RPAREN' || token.kind === 'RBRACKET') depth -= 1;
    else if (depth === 0 && token.kind === 'IDENT' && token.text === 'schema') {
      const comparator = tokens[i + 1];
      const refToken = tokens[i + 2];
      if (
        comparator &&
        comparator.kind === 'COMPARATOR' &&
        (comparator.text === ':' || comparator.text === '=') &&
        refToken &&
        (refToken.kind === 'STRING' || refToken.kind === 'IDENT')
      ) {
        const ref = refToken.kind === 'STRING' ? (refToken.value as string) : refToken.text;
        const id = schemaNameMap(schemas).get(ref);
        if (id) return id;
      }
    }
  }
  return undefined;
};

export const parseEntityQueryText = (
  text: string,
  schemas: SchemaCatalog,
  enums: EnumCatalog,
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): TextParseResult => {
  try {
    const tokens = tokenize(text);
    const rootSchemaId = deriveRootSchemaId(tokens, schemas);
    const state: ParserState = { tokens, pos: 0, hopsUsed: 0, authCtx };
    const root = parseOrExpr(state, rootSchemaId, undefined, schemas, relationSchemas, enums, true);
    if (peek(state).kind !== 'EOF') {
      throw new TextCompileError(
        `Unexpected trailing input '${peek(state).text}'`,
        peek(state).offset
      );
    }
    return { ok: true, query: { root } };
  } catch (error) {
    if (error instanceof TextCompileError) {
      return { ok: false, errors: [{ offset: error.offset, message: error.message }] };
    }
    throw error;
  }
};

// ── Printer (IR -> text) ─────────────────────────────────────────────────

const quoteString = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const printSchemaRef = (name: string): string =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quoteString(name);

const fieldTypeAt = (
  fieldId: string,
  schemaId: string | undefined,
  schemas: SchemaCatalog
): SchemaField['type'] | undefined => {
  if (!schemaId) return undefined;
  return schemaFieldById(schemas.get(schemaId), fieldId)?.type;
};

const relationFieldTypeAt = (
  fieldId: string,
  relationSchemaId: string | undefined,
  relationSchemas: RelationSchemaCatalog
): RelationField['type'] | undefined => {
  if (!relationSchemaId) return undefined;
  return relationFieldById(relationSchemas.get(relationSchemaId), fieldId)?.type;
};

const printValueLiteral = (
  value: unknown,
  fieldType: SchemaField['type'] | RelationField['type'] | undefined
): string => {
  if (fieldType === 'date') return `date(${quoteString(String(value))})`;
  if (typeof value === 'number') return String(value);
  return quoteString(String(value));
};

const printComparatorAndValue = (
  op: FilterOp,
  value: unknown,
  fieldType: SchemaField['type'] | RelationField['type'] | undefined
): string => {
  switch (op) {
    case 'equals':
    case 'on':
      return `= ${printValueLiteral(value, fieldType)}`;
    case 'not_equals':
      return `!= ${printValueLiteral(value, fieldType)}`;
    case 'contains':
      return `~ ${printValueLiteral(value, fieldType)}`;
    case 'starts_with':
      return `^= ${printValueLiteral(value, fieldType)}`;
    case 'ends_with':
      return `$= ${printValueLiteral(value, fieldType)}`;
    case 'before':
    case 'lt':
      return `< ${printValueLiteral(value, fieldType)}`;
    case 'after':
    case 'gt':
      return `> ${printValueLiteral(value, fieldType)}`;
    case 'gte':
      return `>= ${printValueLiteral(value, fieldType)}`;
    case 'lte':
      return `<= ${printValueLiteral(value, fieldType)}`;
    case 'empty':
      return `= empty`;
    case 'not_empty':
      return `= not_empty`;
    case 'in':
      return `in (${(Array.isArray(value) ? value : [value]).map(v => printValueLiteral(v, fieldType)).join(', ')})`;
  }
};

const printPathSteps = (
  steps: PathStep[],
  startSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  startRelationSchemaId?: string
): {
  text: string;
  endSchemaId: string | undefined;
  endRelationSchemaId: string | undefined;
} => {
  let schemaId = startSchemaId;
  let relationSchemaId = startRelationSchemaId;
  const parts = steps.map(step => {
    if (step.kind === 'forward') {
      const field = schemaFieldById(schemas.get(schemaId ?? ''), step.fieldId);
      if (field && isReferenceOrContainmentField(field)) schemaId = field.schemaId;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'backward') {
      const ownerName = printSchemaRef(schemaNameById(schemas, step.ownerSchemaId));
      schemaId = step.ownerSchemaId;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `<-${ownerName}.${step.fieldId}${filterText}`;
    }
    if (step.kind === 'endpoint') {
      // Only legal when the current position is a relation (relationSchemaId cursor set) — the
      // validator already guarantees this for any IR built through validateEntityQueryIR.
      const relationSchema = relationSchemaId ? relationSchemas.get(relationSchemaId) : undefined;
      const targetSchemaIds =
        step.direction === 'in' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
      schemaId = targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
      relationSchemaId = undefined;
      return step.direction === 'in' ? '_in' : '_out';
    }
    if (step.kind === 'relationForward') {
      const relationSchema = relationSchemaId ? relationSchemas.get(relationSchemaId) : undefined;
      const field = relationFieldById(relationSchema, step.fieldId);
      schemaId = field && field.type === 'entityRelation' ? field.schemaId : undefined;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'relationBackward') {
      const relationName = printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      );
      relationSchemaId = step.relationSchemaId;
      schemaId = undefined;
      const filterText = step.filter
        ? `[${printNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
        : '';
      return `<-${relationName}.${step.fieldId}${filterText}`;
    }
    if (step.kind === 'unboundTypedRelation') {
      const relationName = printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      );
      const relationSchema = relationSchemas.get(step.relationSchemaId);
      const targetSchemaIds =
        step.direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
      schemaId =
        Array.isArray(targetSchemaIds) && targetSchemaIds.length === 1
          ? targetSchemaIds[0]
          : undefined;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
        : '';
      return `${step.direction === 'in' ? '->' : '<-'}${relationName}${filterText}`;
    }
    const relationSchema = relationSchemas.get(step.relationSchemaId);
    const targetSchemaIds =
      step.direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
    schemaId = targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
    relationSchemaId = undefined;
    const filterText = step.filter
      ? `[${printNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
      : '';
    return `${step.fieldId}${filterText}`;
  });
  return { text: parts.join('.'), endSchemaId: schemaId, endRelationSchemaId: relationSchemaId };
};

const printPredicateOrRelationExists = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  if (node.kind === 'relationExists') {
    const { text } = printPathSteps(
      node.path,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId
    );
    return text;
  }
  if (node.kind !== 'predicate') throw new Error('unreachable');

  if (node.path.length === 0 && node.fieldId === '_schemaId' && node.op === 'equals') {
    return `schema:${printSchemaRef(schemaNameById(schemas, node.value as string))}`;
  }

  const {
    text: pathText,
    endSchemaId,
    endRelationSchemaId
  } = printPathSteps(node.path, schemaId, schemas, relationSchemas, relationSchemaId);
  const fieldType = endRelationSchemaId
    ? relationFieldTypeAt(node.fieldId, endRelationSchemaId, relationSchemas)
    : fieldTypeAt(node.fieldId, endSchemaId, schemas);
  const fullPath = pathText ? `${pathText}.${node.fieldId}` : node.fieldId;
  if (node.op === 'not_empty') return fullPath;
  return `${fullPath} ${printComparatorAndValue(node.op, node.value, fieldType)}`;
};

const printUnary = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  if (node.kind === 'and' || node.kind === 'or') {
    return `(${printNode(node, schemaId, schemas, relationSchemas, relationSchemaId)})`;
  }
  return printNode(node, schemaId, schemas, relationSchemas, relationSchemaId);
};

const printNode = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  switch (node.kind) {
    case 'and':
      return node.children
        .map(c => printUnary(c, schemaId, schemas, relationSchemas, relationSchemaId))
        .join(' AND ');
    case 'or':
      return node.children
        .map(c => printUnary(c, schemaId, schemas, relationSchemas, relationSchemaId))
        .join(' OR ');
    case 'not':
      return `NOT ${printUnary(node.child, schemaId, schemas, relationSchemas, relationSchemaId)}`;
    case 'freeText':
      return `text:${quoteString(node.value)}`;
    case 'predicate':
    case 'relationExists':
      return printPredicateOrRelationExists(
        node,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId
      );
  }
};

// Mirrors `deriveRootSchemaId`'s text-side prepass: finds a top-level `_schemaId equals X`
// predicate (the IR shape a `schema:X` qualifier compiles to) so sibling predicates in the same
// `and` can resolve their own paths' field types (e.g. to re-wrap a date value in `date(...)`)
// without needing their own explicit schema context.
const deriveRootSchemaIdFromIR = (node: QueryNode): string | undefined => {
  if (node.kind !== 'and') return undefined;
  for (const child of node.children) {
    if (child.kind === 'predicate' && child.path.length === 0 && child.fieldId === '_schemaId') {
      return child.value as string;
    }
  }
  return undefined;
};

// Renders an `EntityQuery` back to grammar-conformant text. Not every IR tree necessarily has a
// canonical rendering (specs/QUERY_LANGUAGE.md §10) — this covers every shape the parser above can
// produce for a `root`-only query (no `projections`, out of scope per #2329).
export const printEntityQueryText = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog = new Map()
): string => printNode(query.root, deriveRootSchemaIdFromIR(query.root), schemas, relationSchemas);
