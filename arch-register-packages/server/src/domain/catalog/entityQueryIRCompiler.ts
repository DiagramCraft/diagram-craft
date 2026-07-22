import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import {
  ENTITY_BUILTIN_COLUMNS,
  ENTITY_ARRAY_COLUMNS,
  isValidFieldId,
  buildConditionClause
} from './db/filterBuilder';
import type { SchemaCatalog } from './entityQueryIRValidator';

export type EntityQueryDialect = 'postgres' | 'sqlite';

export type CompiledEntityQuery = { sql: string; params: unknown[] };

// Raised for a fieldId/op combination that has no SQL translation in this dialect today —
// `_assessment`/`_assessment:<fieldId>` (joined-assessment data, addressed against a bulk
// in-memory response map, not a table) and `_completeness` (computed post-fetch from schema +
// data) are the same hybrid-seam fallback category `entityQueryOperations.ts` already has for
// flat conditions (specs/QUERY_LANGUAGE.md §9); wiring that fallback into this compiler's caller
// is follow-up work, not something this compiler should silently paper over.
export class UnsupportedEntityQueryIRError extends Error {}

const ROOT_ALIAS = 'e0';

type CompileState = {
  dialect: EntityQueryDialect;
  workspace: string;
  params: unknown[];
  nextAliasIndex: number;
};

const addParam = (state: CompileState, value: unknown): string => {
  state.params.push(value);
  return state.dialect === 'postgres' ? `$${state.params.length}` : '?';
};

const nextAlias = (state: CompileState): string => `e${state.nextAliasIndex++}`;

const scopeClause = (state: CompileState, alias: string): string =>
  `${alias}.workspace = ${addParam(state, state.workspace)} AND ${alias}.deleted_at IS NULL`;

const assertValidFieldId = (fieldId: string): void => {
  if (!isValidFieldId(fieldId)) {
    throw new UnsupportedEntityQueryIRError(`Invalid field id '${fieldId}'`);
  }
};

// Mirrors `buildArrayConditionClause` in filterBuilder.ts (used today for the `_tags` array
// column), generalized to a relation hop: does `ownerAlias.data[fieldId]` (a JSON array of entity
// ids, per §2/§4.2 — reference/containment values are always stored as an array, even for
// maxCount: 1 containment fields) contain `targetAlias.id`.
const relationJoinClause = (
  ownerAlias: string,
  fieldId: string,
  targetAlias: string,
  dialect: EntityQueryDialect
): string => {
  assertValidFieldId(fieldId);
  if (dialect === 'postgres') {
    return `EXISTS (SELECT 1 FROM jsonb_array_elements_text(${ownerAlias}.data->'${fieldId}') t WHERE t = ${targetAlias}.id::text)`;
  }
  return `EXISTS (SELECT 1 FROM json_each(${ownerAlias}.data, '$.${fieldId}') WHERE value = ${targetAlias}.id)`;
};

const resolveColumn = (
  alias: string,
  fieldId: string,
  dialect: EntityQueryDialect
): { col: string; kind: 'scalar' | 'array' } | null => {
  if (fieldId === '_id') return { col: `${alias}.id`, kind: 'scalar' };
  if (Object.hasOwn(ENTITY_BUILTIN_COLUMNS, fieldId)) {
    return {
      col: `${alias}.${ENTITY_BUILTIN_COLUMNS[fieldId]!.slice('e.'.length)}`,
      kind: 'scalar'
    };
  }
  if (Object.hasOwn(ENTITY_ARRAY_COLUMNS, fieldId)) {
    return { col: `${alias}.${ENTITY_ARRAY_COLUMNS[fieldId]!.slice('e.'.length)}`, kind: 'array' };
  }
  if (
    fieldId === '_completeness' ||
    fieldId === '_assessment' ||
    fieldId.startsWith('_assessment:')
  ) {
    return null;
  }
  if (!isValidFieldId(fieldId)) return null;
  return {
    col:
      dialect === 'postgres'
        ? `(${alias}.data->>'${fieldId}')`
        : `json_extract(${alias}.data, '$.${fieldId}')`,
    kind: 'scalar'
  };
};

const compilePredicateTerminal =
  (
    fieldId: string,
    op: FilterCondition['op'],
    value: unknown,
    dialect: EntityQueryDialect,
    state: CompileState
  ) =>
  (alias: string): string => {
    const resolved = resolveColumn(alias, fieldId, dialect);
    if (!resolved) {
      throw new UnsupportedEntityQueryIRError(
        `Field '${fieldId}' has no SQL translation (assessment/completeness fields require in-memory evaluation)`
      );
    }
    const clause = buildConditionClause(
      resolved.col,
      { fieldId, op, value },
      v => addParam(state, v),
      dialect,
      resolved.kind
    );
    if (!clause) {
      throw new UnsupportedEntityQueryIRError(
        `Operator '${op}' has no SQL translation for field '${fieldId}'`
      );
    }
    return clause;
  };

// Walks a PathStep[] emitting one correlated EXISTS subquery per hop (forward: the current alias's
// JSON field contains the next alias's id; backward: the next alias's JSON field contains the
// current alias's id, scoped to `ownerSchemaId`). `step.filter`, when present, is ANDed into the
// SAME subquery the step introduces — this is what preserves "same witness" semantics for `[...]`
// scoping (specs/QUERY_LANGUAGE.md §4.3): the filter and the rest of the path both resolve against
// the identical joined row, not a separately-joined copy.
const compilePathSteps = (
  steps: PathStep[],
  index: number,
  curAlias: string,
  schemas: SchemaCatalog,
  state: CompileState,
  terminal: (alias: string) => string
): string => {
  if (index >= steps.length) return terminal(curAlias);

  const step = steps[index]!;
  const alias = nextAlias(state);
  const joinClause =
    step.kind === 'forward'
      ? relationJoinClause(curAlias, step.fieldId, alias, state.dialect)
      : relationJoinClause(alias, step.fieldId, curAlias, state.dialect);
  const ownerSchemaClause =
    step.kind === 'backward'
      ? ` AND ${alias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
      : '';
  // Each piece below must be *evaluated* (not just concatenated) in the same left-to-right order
  // its placeholder appears in the returned SQL text — addParam pushes onto state.params as a
  // side effect, so evaluation order and placeholder order must match or params end up transposed.
  const scopePart = ` AND ${scopeClause(state, alias)}`;
  const filterClause = step.filter ? ` AND ${compileNode(step.filter, alias, schemas, state)}` : '';
  const rest = compilePathSteps(steps, index + 1, alias, schemas, state, terminal);

  return (
    `EXISTS (SELECT 1 FROM entity ${alias} WHERE ${joinClause}${ownerSchemaClause}` +
    `${scopePart}${filterClause} AND ${rest})`
  );
};

const compileNode = (
  node: QueryNode,
  alias: string,
  schemas: SchemaCatalog,
  state: CompileState
): string => {
  switch (node.kind) {
    case 'and':
      return node.children.length === 0
        ? '1=1'
        : `(${node.children.map(child => compileNode(child, alias, schemas, state)).join(' AND ')})`;
    case 'or':
      return node.children.length === 0
        ? '1=0'
        : `(${node.children.map(child => compileNode(child, alias, schemas, state)).join(' OR ')})`;
    case 'not':
      return `NOT (${compileNode(node.child, alias, schemas, state)})`;
    case 'predicate':
      return compilePathSteps(
        node.path,
        0,
        alias,
        schemas,
        state,
        compilePredicateTerminal(node.fieldId, node.op, node.value, state.dialect, state)
      );
    case 'relationExists':
      return compilePathSteps(node.path, 0, alias, schemas, state, () => '1=1');
  }
};

// Compiles a validated EntityQuery into a full `SELECT ... FROM entity e0 ...` statement, joining
// the same denormalized owner/lifecycle/schema-name columns `ENTITY_SELECT_SQL` (catalogDatabase.ts)
// already attaches for a live entity row. Callers must validate the query first
// (entityQueryIRValidator.ts) — this function assumes a structurally valid IR and does not
// re-check hop counts or backward-step ownership.
export const compileEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string
): CompiledEntityQuery => {
  const state: CompileState = { dialect, workspace, params: [], nextAliasIndex: 1 };
  const whereParts = [scopeClause(state, ROOT_ALIAS)];
  if (query.schemaId) {
    whereParts.push(`${ROOT_ALIAS}.schema_id = ${addParam(state, query.schemaId)}`);
  }
  whereParts.push(compileNode(query.root, ROOT_ALIAS, schemas, state));

  const sql = `
    SELECT ${ROOT_ALIAS}.*,
      wo.name   AS owner_name,
      ls.label  AS lifecycle_label,
      tls.label AS target_lifecycle_label,
      es.name   AS schema_name
    FROM entity ${ROOT_ALIAS}
    LEFT JOIN workspace_owner wo            ON wo.id  = ${ROOT_ALIAS}.owner
    LEFT JOIN workspace_lifecycle_state ls  ON ls.id  = ${ROOT_ALIAS}.lifecycle
    LEFT JOIN workspace_lifecycle_state tls ON tls.id = ${ROOT_ALIAS}.target_lifecycle
    JOIN entity_schema es ON es.id = ${ROOT_ALIAS}.schema_id
    WHERE ${whereParts.join(' AND ')}
    ORDER BY ${ROOT_ALIAS}.name, ${ROOT_ALIAS}.id
  `;

  return { sql, params: state.params };
};
