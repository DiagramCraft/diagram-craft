import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type {
  EntityQuery,
  PathStep,
  ProjectionField,
  QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  ASSESSMENT_PRESENCE_FIELD_ID,
  ASSESSMENT_FIELD_PREFIX
} from '@arch-register/api-types/assessmentFilter';
import {
  ENTITY_BUILTIN_COLUMNS,
  ENTITY_ARRAY_COLUMNS,
  isValidFieldId,
  buildConditionClause
} from './db/filterBuilder';
import {
  resolveFieldSchemaScope,
  resolveRelationFieldSchemaScope,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRValidator';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';

export type EntityQueryDialect = 'postgres' | 'sqlite';

export type CompiledEntityQuery = { sql: string; params: unknown[] };

export type CompiledEntityQueryOptions = {
  visibleEntityIds?: readonly string[];
  // Relation-root visibility gate. Unlike entity visibility (a per-entity ACL check), relation
  // visibility depends on both endpoint entities' schemas and the relation schema's viewable
  // typed-relation grant, so it can't be recomputed as flat SQL — callers precompute it in JS
  // (mirrors canViewTypedRelation) and pass the resulting id set in.
  visibleRelationIds?: readonly string[];
  // SQL-level pagination for the relation-rooted path only (see compileEntityQueryIR). The
  // entity-rooted path still collects-then-slices in JS because collectEntitiesFromIR applies a
  // JS-only post-filter (collectionEntityIds) after the compiled query runs, which SQL LIMIT/OFFSET
  // would silently under-fill against — see #2700.
  limit?: number;
  offset?: number;
};

// Raised for a fieldId/op combination that has no SQL translation in this dialect today. As of
// #2346, `_completeness` is a materialized column on `entity` (kept in sync at write time, see
// entityMutations.ts) rather than an in-memory-only computation, so it resolves like any other
// builtin column below — it is no longer a case this error covers. `_assessment`/
// `_assessment:<fieldId>` are likewise fully SQL-native, backed by the normalized, entity_id-keyed
// `assessment_response` table.
export class UnsupportedEntityQueryIRError extends Error {}

// Every alias (root and every hop) is drawn from this CTE rather than the raw `entity` table, so
// there is exactly one place that defines "which entities/rows are in scope for this query" —
// workspace, soft-delete, and (later) project-scoping or asOf point-in-time reconstruction all
// become a change to this one CTE body rather than to every join/EXISTS this compiler emits.
// It also joins the query's single joined assessment (if any) once, so `_assessment*` predicates
// at any traversal position read a plain column (`assessment_values`) instead of each needing their
// own correlated subquery.
const SCOPE_CTE = 'scoped_entity';
// Every typed-relation join is drawn from this CTE rather than raw `catalog_record`, mirroring
// SCOPE_CTE's role for entities: it's the one place asOf point-in-time reconstruction is applied
// to relation rows, so a historical query sees relation existence/data as it was at that time
// rather than always reading the live row (#2687).
const RELATION_SCOPE_CTE = 'scoped_relation';
const ROOT_ALIAS = 'e0';

type CompileState = {
  dialect: EntityQueryDialect;
  workspace: string;
  authCtx: WorkspaceAuthorizationContext | null;
  relationSchemas: RelationSchemaCatalog;
  // Which catalog-record kind ROOT_ALIAS (e0) is bound to — 'relation' means e0 reads from
  // RELATION_SCOPE_CTE instead of SCOPE_CTE. Every alias reached via an 'endpoint' path step is
  // always an entity, regardless of this flag.
  rootKind: 'entity' | 'relation';
  assessmentId: string | undefined;
  projectId: string | undefined;
  projectScope: 'project' | 'all';
  asOf: Date | null;
  includePlannedChanges: boolean;
  params: unknown[];
  nextAliasIndex: number;
  nextRelationAliasIndex: number;
  projectionBindings: ProjectionBinding[];
  bindingByPath: Map<string, ProjectionBinding>;
  compilingBinding: boolean;
  visibleEntityIds?: readonly string[];
  visibleRelationIds?: readonly string[];
  limit?: number;
  offset?: number;
};

type ProjectionBinding = {
  name: string;
  path: PathStep[];
};

const addParam = (state: CompileState, value: unknown): string => {
  state.params.push(value);
  return state.dialect === 'postgres' ? `$${state.params.length}` : '?';
};

const nextAlias = (state: CompileState): string => `e${state.nextAliasIndex++}`;
const nextRelationAlias = (state: CompileState): string => `r${state.nextRelationAliasIndex++}`;

const pathKey = (path: PathStep[]): string => JSON.stringify(path);

const pathStartsWith = (path: PathStep[], prefix: PathStep[]): boolean =>
  prefix.every((step, index) => JSON.stringify(path[index]) === JSON.stringify(step));

const collectRootPathOccurrences = (node: QueryNode, occurrences: PathStep[][]): void => {
  switch (node.kind) {
    case 'and':
    case 'or':
      node.children.forEach(child => collectRootPathOccurrences(child, occurrences));
      return;
    case 'not':
      collectRootPathOccurrences(node.child, occurrences);
      return;
    case 'predicate':
    case 'relationExists':
      if (node.path.length > 0) occurrences.push(node.path);
      return;
  }
};

const relationIsMultiValued = (
  path: PathStep[],
  schemas: SchemaCatalog,
  _relationSchemas: RelationSchemaCatalog
): boolean =>
  path.some(step => {
    if (step.kind === 'typedRelation') return true;
    // 'endpoint' (relation -> its in/out entity) is exactly one entity per direction, never
    // multi-valued.
    if (step.kind === 'endpoint') return false;
    const fields =
      step.kind === 'backward'
        ? [schemas.get(step.ownerSchemaId)?.fields.find(field => field.id === step.fieldId)]
        : [...schemas.values()].map(schema =>
            schema.fields.find(field => field.id === step.fieldId)
          );
    return fields.some(
      field => field !== undefined && isReferenceOrContainmentField(field) && field.maxCount !== 1
    );
  });

const effectiveProjectionAlias = (projection: ProjectionField): string => {
  if (projection.alias) return projection.alias;
  const path = projection.path
    .map(step => {
      switch (step.kind) {
        case 'forward':
          return step.fieldId;
        case 'backward':
          return `<-${step.ownerSchemaId}.${step.fieldId}`;
        case 'endpoint':
          return `endpoint(${step.direction})`;
        case 'typedRelation':
          return step.fieldId;
      }
    })
    .join('.');
  return path ? `${path}.${projection.fieldId}` : projection.fieldId;
};

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
  if (!isValidFieldId(fieldId)) return null;
  return {
    col:
      dialect === 'postgres'
        ? `(${alias}.data->>'${fieldId}')`
        : `json_extract(${alias}.data, '$.${fieldId}')`,
    kind: 'scalar'
  };
};

// Renders `alias.schema_id IN (...)` for a field id that some (but not all) schemas in the
// catalog restrict, so a bare field-id read against `alias` doesn't leak rows from a schema that
// puts the same field id in a restricted group (#2592). Returns null when no schema restricts the
// field at all — the overwhelmingly common case — so non-colliding queries emit no extra SQL.
const schemaScopeClause = (
  alias: string,
  fieldId: string,
  schemas: SchemaCatalog,
  state: CompileState
): string | null => {
  const scope = resolveFieldSchemaScope(fieldId, schemas, state.authCtx);
  if (!scope.needsScoping) return null;
  if (scope.grantedSchemaIds.size === 0) return '1=0';
  return `${alias}.schema_id IN (${[...scope.grantedSchemaIds]
    .map(id => addParam(state, id))
    .join(', ')})`;
};

// Relation-schema counterpart to schemaScopeClause, for relation-rooted predicates/projections (#2701).
const relationSchemaScopeClause = (
  alias: string,
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  state: CompileState
): string | null => {
  const scope = resolveRelationFieldSchemaScope(fieldId, relationSchemas, state.authCtx);
  if (!scope.needsScoping) return null;
  if (scope.grantedSchemaIds.size === 0) return '1=0';
  return `${alias}.schema_id IN (${[...scope.grantedSchemaIds]
    .map(id => addParam(state, id))
    .join(', ')})`;
};

const typedRelationOwnerSchemaClause = (
  alias: string,
  ownerSchemaIds: readonly string[],
  state: CompileState
): string => {
  if (ownerSchemaIds.length === 0) return '1=0';
  return `${alias}.schema_id IN (${ownerSchemaIds.map(id => addParam(state, id)).join(', ')})`;
};

const requireAssessmentId = (state: CompileState): void => {
  if (!state.assessmentId) {
    throw new UnsupportedEntityQueryIRError(
      "'_assessment'/'_assessment:<fieldId>' predicates require EntityQuery.assessmentId to be set"
    );
  }
};

// `_assessment` (presence pseudo-field): mirrors `matchesAssessmentConditions`'s handling in
// assessmentFilter.ts — only `empty`/`not_empty` are meaningful; any other op is vacuously true,
// matching that function's existing fallback for ops it doesn't special-case. `assessment_values`
// is NULL on `${SCOPE_CTE}` whenever the LEFT JOIN found no response row for that alias.
const compileAssessmentPresence = (
  alias: string,
  op: FilterCondition['op'],
  state: CompileState
): string => {
  requireAssessmentId(state);
  if (op === 'not_empty') return `${alias}.assessment_values IS NOT NULL`;
  if (op === 'empty') return `${alias}.assessment_values IS NULL`;
  return '1=1';
};

// `_assessment:<fieldId>`: extracts the addressed field out of the joined response's
// `assessment_values` column and evaluates it via the same generic buildConditionClause op
// semantics as an ordinary scalar field — a deliberate simplification, not a byte-for-byte match of
// `matchesAssessmentConditions`'s per-assessment-field-type branching (rating/enum/text). Revisit
// if callers need that same type-awareness in the SQL path; it would require passing the
// assessment's `AssessmentField[]` definitions into the compiler.
const assessmentFieldColumn = (
  alias: string,
  assessmentFieldId: string,
  dialect: EntityQueryDialect,
  state: CompileState
): string => {
  requireAssessmentId(state);
  assertValidFieldId(assessmentFieldId);
  return dialect === 'postgres'
    ? `(${alias}.assessment_values->>'${assessmentFieldId}')`
    : `json_extract(${alias}.assessment_values, '$.${assessmentFieldId}')`;
};

const compilePredicateTerminal =
  (
    fieldId: string,
    op: FilterCondition['op'],
    value: unknown,
    schemas: SchemaCatalog,
    dialect: EntityQueryDialect,
    state: CompileState
  ) =>
  (alias: string): string => {
    if (fieldId === ASSESSMENT_PRESENCE_FIELD_ID) {
      return compileAssessmentPresence(alias, op, state);
    }

    const resolved = fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)
      ? {
          col: assessmentFieldColumn(
            alias,
            fieldId.slice(ASSESSMENT_FIELD_PREFIX.length),
            dialect,
            state
          ),
          kind: 'scalar' as const
        }
      : resolveColumn(alias, fieldId, dialect);
    if (!resolved) {
      throw new UnsupportedEntityQueryIRError(`Field '${fieldId}' has no SQL translation`);
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
    const scopeClause = schemaScopeClause(alias, fieldId, schemas, state);
    return scopeClause ? `(${clause} AND ${scopeClause})` : clause;
  };

const compileFreeTextTerminal = (
  alias: string,
  value: string,
  schemas: SchemaCatalog,
  state: CompileState
): string =>
  `(${['_name', '_slug', '_description']
    .map(fieldId =>
      compilePredicateTerminal(fieldId, 'contains', value, schemas, state.dialect, state)(alias)
    )
    .join(' OR ')})`;

// Mirrors ENTITY_BUILTIN_COLUMNS for relation rows. Kept local (not filterBuilder.ts) since these
// pseudo-fields only exist for relation-rooted queries/projections.
const RELATION_BUILTIN_COLUMNS: Record<string, string> = {
  _id: 'id',
  _schemaId: 'schema_id',
  _inEntityId: 'in_record_id',
  _outEntityId: 'out_record_id',
  _createdAt: 'created_at',
  _updatedAt: 'updated_at'
};

const resolveRelationColumn = (
  alias: string,
  fieldId: string,
  dialect: EntityQueryDialect
): { col: string; kind: 'scalar' } | null => {
  if (Object.hasOwn(RELATION_BUILTIN_COLUMNS, fieldId)) {
    return { col: `${alias}.${RELATION_BUILTIN_COLUMNS[fieldId]}`, kind: 'scalar' };
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

const RELATION_PSEUDO_FIELD_IDS = new Set(Object.keys(RELATION_BUILTIN_COLUMNS));

const compileRelationRootPredicateTerminal =
  (fieldId: string, op: FilterCondition['op'], value: unknown, state: CompileState) =>
  (alias: string): string => {
    const resolved = resolveRelationColumn(alias, fieldId, state.dialect);
    if (!resolved) {
      throw new UnsupportedEntityQueryIRError(`Field '${fieldId}' has no SQL translation`);
    }
    const clause = buildConditionClause(
      resolved.col,
      { fieldId, op, value },
      v => addParam(state, v),
      state.dialect,
      resolved.kind
    );
    if (!clause) {
      throw new UnsupportedEntityQueryIRError(
        `Operator '${op}' has no SQL translation for field '${fieldId}'`
      );
    }
    const scopeClause = relationSchemaScopeClause(alias, fieldId, state.relationSchemas, state);
    return scopeClause ? `(${clause} AND ${scopeClause})` : clause;
  };

const projectionRawValueRelation = (
  alias: string,
  fieldId: string,
  dialect: EntityQueryDialect
): string => {
  if (Object.hasOwn(RELATION_BUILTIN_COLUMNS, fieldId)) {
    const column = `${alias}.${RELATION_BUILTIN_COLUMNS[fieldId]}`;
    return dialect === 'postgres' ? `to_jsonb(${column})` : column;
  }
  assertValidFieldId(fieldId);
  return dialect === 'postgres'
    ? `${alias}.data->'${fieldId}'`
    : `json_extract(${alias}.data, '$.${fieldId}')`;
};

const compileRelationNode = (
  node: QueryNode,
  alias: string,
  relationSchemaId: string,
  relationSchemas: RelationSchemaCatalog,
  state: CompileState
): string => {
  switch (node.kind) {
    case 'and':
      return node.children.length === 0
        ? '1=1'
        : `(${node.children
            .map(child =>
              compileRelationNode(child, alias, relationSchemaId, relationSchemas, state)
            )
            .join(' AND ')})`;
    case 'or':
      return node.children.length === 0
        ? '1=0'
        : `(${node.children
            .map(child =>
              compileRelationNode(child, alias, relationSchemaId, relationSchemas, state)
            )
            .join(' OR ')})`;
    case 'not':
      return `NOT (${compileRelationNode(node.child, alias, relationSchemaId, relationSchemas, state)})`;
    case 'predicate': {
      if (node.path.length > 0) {
        throw new UnsupportedEntityQueryIRError(
          'Relation-instance filters cannot traverse nested entity paths'
        );
      }
      const resolved = resolveRelationColumn(alias, node.fieldId, state.dialect);
      if (!RELATION_PSEUDO_FIELD_IDS.has(node.fieldId)) {
        const relationSchema = relationSchemas.get(relationSchemaId);
        const field = relationSchema?.fields.find(candidate => candidate.id === node.fieldId);
        if (!relationSchema || !field) {
          throw new UnsupportedEntityQueryIRError(
            `Relation schema '${relationSchemaId}' has no scalar field '${node.fieldId}'`
          );
        }
      }
      if (!resolved) {
        throw new UnsupportedEntityQueryIRError(
          `Relation schema '${relationSchemaId}' has no scalar field '${node.fieldId}'`
        );
      }
      const clause = buildConditionClause(
        resolved.col,
        { fieldId: node.fieldId, op: node.op, value: node.value },
        value => addParam(state, value),
        state.dialect,
        resolved.kind
      );
      if (!clause) {
        throw new UnsupportedEntityQueryIRError(
          `Operator '${node.op}' has no SQL translation for relation field '${node.fieldId}'`
        );
      }
      return clause;
    }
    case 'freeText':
    case 'relationExists':
      throw new UnsupportedEntityQueryIRError(
        'Relation-instance filters may only contain scalar field predicates'
      );
  }
};

// Walks a PathStep[] emitting one correlated EXISTS subquery per hop (forward: the current alias's
// JSON field contains the next alias's id; backward: the next alias's JSON field contains the
// current alias's id, scoped to `ownerSchemaId`). `step.filter`, when present, is ANDed into the
// SAME subquery the step introduces — this is what preserves "same witness" semantics for `[...]`
// scoping (specs/QUERY_LANGUAGE.md §4.3): the filter and the rest of the path both resolve against
// the identical joined row, not a separately-joined copy. Every hop is drawn `FROM scoped_entity`,
// not `FROM entity` — workspace/soft-delete/project scoping is already baked into that CTE.
const compilePathSteps = (
  steps: PathStep[],
  index: number,
  curAlias: string,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  state: CompileState,
  terminal: (alias: string) => string
): string => {
  if (index >= steps.length) return terminal(curAlias);

  const step = steps[index]!;
  if (step.kind === 'endpoint') {
    // Relation -> its in/out entity endpoint. curAlias is a relation-scope alias here (r0 or a
    // subsequent relation alias reached via typedRelation); the target is an ordinary entity.
    const alias = nextAlias(state);
    const targetId =
      step.direction === 'in' ? `${curAlias}.in_record_id` : `${curAlias}.out_record_id`;
    const rest = compilePathSteps(
      steps,
      index + 1,
      alias,
      schemas,
      relationSchemas,
      state,
      terminal
    );
    return `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${alias}.id = ${targetId} AND ${rest})`;
  }
  if (step.kind === 'typedRelation') {
    const relationAlias = nextRelationAlias(state);
    const targetAlias = nextAlias(state);
    const ownerId =
      step.direction === 'in' ? `${relationAlias}.in_record_id` : `${relationAlias}.out_record_id`;
    const targetId =
      step.direction === 'in' ? `${relationAlias}.out_record_id` : `${relationAlias}.in_record_id`;
    const relationSchemaParam = addParam(state, step.relationSchemaId);
    const ownerSchemaClause = typedRelationOwnerSchemaClause(curAlias, step.ownerSchemaIds, state);
    const filterClause = step.filter
      ? ` AND ${compileRelationNode(
          step.filter,
          relationAlias,
          step.relationSchemaId,
          relationSchemas,
          state
        )}`
      : '';
    const rest = compilePathSteps(
      steps,
      index + 1,
      targetAlias,
      schemas,
      relationSchemas,
      state,
      terminal
    );
    return (
      `EXISTS (SELECT 1 FROM ${RELATION_SCOPE_CTE} ${relationAlias} ` +
      `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} ` +
      `WHERE ${relationAlias}.workspace = ${curAlias}.workspace ` +
      `AND ${relationAlias}.schema_id = ${relationSchemaParam} ` +
      `AND ${ownerSchemaClause} ` +
      `AND ${ownerId} = ${curAlias}.id${filterClause} AND ${rest})`
    );
  }
  const alias = nextAlias(state);
  const joinClause =
    step.kind === 'forward'
      ? relationJoinClause(curAlias, step.fieldId, alias, state.dialect)
      : relationJoinClause(alias, step.fieldId, curAlias, state.dialect);
  // Must be evaluated (not just concatenated) in the same left-to-right order its placeholder
  // appears in the returned SQL text — addParam pushes onto state.params as a side effect, so
  // evaluation order and placeholder order must match or params end up transposed.
  const ownerSchemaClause =
    step.kind === 'backward'
      ? ` AND ${alias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
      : '';
  // A forward step's fieldId is read off `curAlias` (the hop's source row), so a field id that
  // collides across schemas needs `curAlias` (not the newly-joined `alias`) scoped to the schemas
  // that actually grant it (#2592) — mirrors ownerSchemaClause's role for backward steps.
  const forwardScopeClause =
    step.kind === 'forward'
      ? (() => {
          const scope = schemaScopeClause(curAlias, step.fieldId, schemas, state);
          return scope ? ` AND ${scope}` : '';
        })()
      : '';
  const filterClause = step.filter
    ? ` AND ${compileNode(step.filter, alias, schemas, relationSchemas, state, false)}`
    : '';
  const rest = compilePathSteps(steps, index + 1, alias, schemas, relationSchemas, state, terminal);

  return (
    `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${joinClause}${ownerSchemaClause}` +
    `${forwardScopeClause}${filterClause} AND ${rest})`
  );
};

const compileBoundNode = (
  node: Extract<QueryNode, { kind: 'predicate' | 'relationExists' }>,
  alias: string,
  binding: ProjectionBinding,
  schemas: SchemaCatalog,
  state: CompileState
): string => {
  const bindingAlias = `pb_${binding.name}`;
  const rootClause = `${bindingAlias}.root_id = ${alias}.id`;
  if (node.kind === 'relationExists') {
    return `EXISTS (SELECT 1 FROM ${binding.name} ${bindingAlias} WHERE ${rootClause})`;
  }

  const targetAlias = `pt_${binding.name}`;
  const targetId = `${bindingAlias}.hop_${node.path.length}_id`;
  const terminal = compilePredicateTerminal(
    node.fieldId,
    node.op,
    node.value,
    schemas,
    state.dialect,
    state
  )(targetAlias);
  return (
    `EXISTS (SELECT 1 FROM ${binding.name} ${bindingAlias} ` +
    `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} ` +
    `WHERE ${rootClause} AND ${terminal})`
  );
};

const compileNode = (
  node: QueryNode,
  alias: string,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  state: CompileState,
  allowFreeText: boolean
): string => {
  switch (node.kind) {
    case 'and':
      return node.children.length === 0
        ? '1=1'
        : `(${node.children
            .map(child => compileNode(child, alias, schemas, relationSchemas, state, allowFreeText))
            .join(' AND ')})`;
    case 'or':
      return node.children.length === 0
        ? '1=0'
        : `(${node.children
            .map(child => compileNode(child, alias, schemas, relationSchemas, state, allowFreeText))
            .join(' OR ')})`;
    case 'not':
      return `NOT (${compileNode(node.child, alias, schemas, relationSchemas, state, allowFreeText)})`;
    case 'freeText':
      if (!allowFreeText) {
        throw new UnsupportedEntityQueryIRError(
          "'freeText' is only valid for the starting entity list"
        );
      }
      return compileFreeTextTerminal(alias, node.value, schemas, state);
    case 'predicate':
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(pathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, schemas, state);
      }
      if (alias === ROOT_ALIAS && state.rootKind === 'relation' && node.path.length === 0) {
        return compileRelationRootPredicateTerminal(
          node.fieldId,
          node.op,
          node.value,
          state
        )(alias);
      }
      return compilePathSteps(
        node.path,
        0,
        alias,
        schemas,
        relationSchemas,
        state,
        compilePredicateTerminal(node.fieldId, node.op, node.value, schemas, state.dialect, state)
      );
    case 'relationExists':
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(pathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, schemas, state);
      }
      return compilePathSteps(node.path, 0, alias, schemas, relationSchemas, state, () => '1=1');
  }
};

const buildProjectionBindings = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  state: CompileState
): string[] => {
  const rootPaths: PathStep[][] = [];
  collectRootPathOccurrences(query.root, rootPaths);
  const projections = query.projections ?? [];
  const pathsToBind = new Map<string, PathStep[]>();

  for (const path of rootPaths) pathsToBind.set(pathKey(path), path);

  for (const projection of projections) {
    if (projection.path.length === 0) continue;
    const candidates = rootPaths.filter(path => pathStartsWith(path, projection.path));
    if (candidates.length > 1 && relationIsMultiValued(projection.path, schemas, relationSchemas)) {
      throw new UnsupportedEntityQueryIRError(
        `Projection '${effectiveProjectionAlias(projection)}' is ambiguous because its multi-valued relation path is constrained by multiple independent predicates`
      );
    }
    if (candidates.length === 0) pathsToBind.set(pathKey(projection.path), projection.path);
  }

  state.projectionBindings = [...pathsToBind.values()].map((path, index) => ({
    name: `query_path_${index}`,
    path
  }));
  state.bindingByPath = new Map(
    state.projectionBindings.map(binding => [pathKey(binding.path), binding])
  );

  return state.projectionBindings.map(binding => {
    const rootAlias = `pb_root_${binding.name}`;
    let currentAlias = rootAlias;
    const selectParts = [`${rootAlias}.id AS root_id`];
    // A binding's root row is always the query root, so it's drawn from whichever scope CTE
    // ROOT_ALIAS itself binds to (relation root paths always start with an 'endpoint' step).
    let from = `FROM ${state.rootKind === 'relation' ? RELATION_SCOPE_CTE : SCOPE_CTE} ${rootAlias}`;

    state.compilingBinding = true;
    binding.path.forEach((step, stepIndex) => {
      if (step.kind === 'endpoint') {
        const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
        const targetId =
          step.direction === 'in'
            ? `${currentAlias}.in_record_id`
            : `${currentAlias}.out_record_id`;
        from += `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId}`;
        selectParts.push(`${targetAlias}.id AS hop_${stepIndex + 1}_id`);
        currentAlias = targetAlias;
        return;
      }
      if (step.kind === 'typedRelation') {
        const relationAlias = `pb_rel_${binding.name}_${stepIndex + 1}`;
        const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
        const ownerId =
          step.direction === 'in'
            ? `${relationAlias}.in_record_id`
            : `${relationAlias}.out_record_id`;
        const targetId =
          step.direction === 'in'
            ? `${relationAlias}.out_record_id`
            : `${relationAlias}.in_record_id`;
        const relationSchema = addParam(state, step.relationSchemaId);
        const ownerSchemaClause = typedRelationOwnerSchemaClause(
          currentAlias,
          step.ownerSchemaIds,
          state
        );
        const filter = step.filter
          ? ` AND ${compileRelationNode(
              step.filter,
              relationAlias,
              step.relationSchemaId,
              relationSchemas,
              state
            )}`
          : '';
        from +=
          `\n      JOIN ${RELATION_SCOPE_CTE} ${relationAlias} ON ${relationAlias}.workspace = ${currentAlias}.workspace` +
          ` AND ${relationAlias}.schema_id = ${relationSchema}` +
          ` AND ${ownerSchemaClause}` +
          ` AND ${ownerId} = ${currentAlias}.id${filter}` +
          `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId}`;
        selectParts.push(
          `${relationAlias}.id AS relation_${stepIndex + 1}_id`,
          `${targetAlias}.id AS hop_${stepIndex + 1}_id`
        );
        currentAlias = targetAlias;
        return;
      }
      const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
      const relation =
        step.kind === 'forward'
          ? relationJoinClause(currentAlias, step.fieldId, targetAlias, state.dialect)
          : relationJoinClause(targetAlias, step.fieldId, currentAlias, state.dialect);
      const ownerSchema =
        step.kind === 'backward'
          ? ` AND ${targetAlias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
          : '';
      // Same rationale as compilePathSteps' forwardScopeClause: a forward step's fieldId is read
      // off `currentAlias`, so that's the alias that needs scoping when the field id collides
      // across schemas (#2592).
      const forwardScope = (() => {
        if (step.kind !== 'forward') return '';
        const scope = schemaScopeClause(currentAlias, step.fieldId, schemas, state);
        return scope ? ` AND ${scope}` : '';
      })();
      const filter = step.filter
        ? ` AND ${compileNode(step.filter, targetAlias, schemas, relationSchemas, state, false)}`
        : '';
      from += `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${relation}${ownerSchema}${forwardScope}${filter}`;
      selectParts.push(`${targetAlias}.id AS hop_${stepIndex + 1}_id`);
      currentAlias = targetAlias;
    });
    state.compilingBinding = false;

    return `${binding.name} AS (SELECT ${selectParts.join(', ')} ${from})`;
  });
};

const projectionBindingFor = (
  projection: ProjectionField,
  state: CompileState
): ProjectionBinding | null => {
  if (projection.path.length === 0) return null;
  const exact = state.bindingByPath.get(pathKey(projection.path));
  if (exact) return exact;
  return (
    state.projectionBindings.find(binding => pathStartsWith(binding.path, projection.path)) ?? null
  );
};

const projectionRawValue = (
  alias: string,
  fieldId: string,
  dialect: EntityQueryDialect
): string => {
  if (fieldId === ASSESSMENT_PRESENCE_FIELD_ID) {
    return dialect === 'postgres'
      ? `to_jsonb(${alias}.assessment_values IS NOT NULL)`
      : `(${alias}.assessment_values IS NOT NULL)`;
  }
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    assertValidFieldId(fieldId.slice(ASSESSMENT_FIELD_PREFIX.length));
    return dialect === 'postgres'
      ? `${alias}.assessment_values->'${fieldId.slice(ASSESSMENT_FIELD_PREFIX.length)}'`
      : `json_extract(${alias}.assessment_values, '$.${fieldId.slice(ASSESSMENT_FIELD_PREFIX.length)}')`;
  }
  if (fieldId === '_id') {
    return dialect === 'postgres' ? `to_jsonb(${alias}.id)` : `${alias}.id`;
  }
  if (Object.hasOwn(ENTITY_ARRAY_COLUMNS, fieldId)) {
    const column = ENTITY_ARRAY_COLUMNS[fieldId]!.replace(/^e\./, `${alias}.`);
    return dialect === 'postgres' ? column : `json(${column})`;
  }
  if (Object.hasOwn(ENTITY_BUILTIN_COLUMNS, fieldId)) {
    const column = ENTITY_BUILTIN_COLUMNS[fieldId]!.replace(/^e\./, `${alias}.`);
    return dialect === 'postgres' ? `to_jsonb(${column})` : column;
  }
  assertValidFieldId(fieldId);
  return dialect === 'postgres'
    ? `${alias}.data->'${fieldId}'`
    : `json_extract(${alias}.data, '$.${fieldId}')`;
};

const projectionValue = (
  projection: ProjectionField,
  schemas: SchemaCatalog,
  state: CompileState
): { value: string; isArray: boolean } => {
  const isArray = relationIsMultiValued(projection.path, schemas, state.relationSchemas);
  const binding = projectionBindingFor(projection, state);
  if (!binding) {
    if (state.rootKind === 'relation' && projection.path.length === 0) {
      // Root-level projection of a relation-rooted query: e0 is a relation row, read directly. A
      // colliding field id needs e0 itself gated to the granting relation schemas, mirroring the
      // entity root-level projection branch below (#2701).
      const raw = projectionRawValueRelation(ROOT_ALIAS, projection.fieldId, state.dialect);
      const scope = relationSchemaScopeClause(
        ROOT_ALIAS,
        projection.fieldId,
        state.relationSchemas,
        state
      );
      return {
        value: scope ? `(CASE WHEN ${scope} THEN ${raw} ELSE NULL END)` : raw,
        isArray: false
      };
    }
    const raw = projectionRawValue(ROOT_ALIAS, projection.fieldId, state.dialect);
    // Root-level projection (no path): reading `data->fieldId` off e0 directly, so a colliding
    // field id needs e0 itself gated to the granting schemas, else a non-granting row's own
    // (unrelated) value at that key would leak (#2592).
    const scope = schemaScopeClause(ROOT_ALIAS, projection.fieldId, schemas, state);
    return {
      value: scope ? `(CASE WHEN ${scope} THEN ${raw} ELSE NULL END)` : raw,
      isArray: false
    };
  }

  const bindingAlias = `pv_${binding.name}`;
  const terminalStep = projection.path[projection.path.length - 1];
  if (projection.source === 'relation' && terminalStep?.kind !== 'typedRelation') {
    throw new UnsupportedEntityQueryIRError(
      'Relation projections must terminate at a typed relation hop'
    );
  }
  const targetAlias = `pv_target_${binding.name}`;
  const targetId = `${bindingAlias}.hop_${projection.path.length}_id`;
  const relationAlias = `pv_relation_${binding.name}`;
  const raw =
    projection.source === 'relation'
      ? state.dialect === 'postgres'
        ? `${relationAlias}.data->'${projection.fieldId}'`
        : `json_extract(${relationAlias}.data, '$.${projection.fieldId}')`
      : projectionRawValue(targetAlias, projection.fieldId, state.dialect);
  const scope =
    projection.source === 'relation'
      ? null
      : schemaScopeClause(targetAlias, projection.fieldId, schemas, state);
  const source =
    `FROM ${binding.name} ${bindingAlias} ` +
    (projection.source === 'relation'
      ? `JOIN ${RELATION_SCOPE_CTE} ${relationAlias} ON ${relationAlias}.id = ${bindingAlias}.relation_${projection.path.length}_id `
      : `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} `) +
    `WHERE ${bindingAlias}.root_id = ${ROOT_ALIAS}.id${scope ? ` AND ${scope}` : ''}`;

  if (!isArray) {
    return { value: `(SELECT ${raw} ${source} LIMIT 1)`, isArray: false };
  }

  if (state.dialect === 'postgres') {
    return {
      value: `(SELECT COALESCE(jsonb_agg(${raw}), '[]'::jsonb) ${source})`,
      isArray: true
    };
  }
  return {
    value: `(SELECT COALESCE(json_group_array(json(json_quote(${raw}))), json('[]')) ${source})`,
    isArray: true
  };
};

const compileProjectionObject = (
  projections: ProjectionField[],
  schemas: SchemaCatalog,
  state: CompileState
): string => {
  if (projections.length === 0) return state.dialect === 'postgres' ? "'{}'::jsonb" : "json('{}')";

  const entries = projections.flatMap(projection => {
    const keyParam = addParam(state, effectiveProjectionAlias(projection));
    const key = state.dialect === 'postgres' ? `${keyParam}::text` : keyParam;
    const projected = projectionValue(projection, schemas, state);
    const value =
      state.dialect === 'sqlite' && projected.isArray
        ? `json(${projected.value})`
        : projected.value;
    return [key, value];
  });
  return state.dialect === 'postgres'
    ? `jsonb_build_object(${entries.join(', ')})`
    : `json_object(${entries.join(', ')})`;
};

const projectScopeClause = (
  entityIdColumn: string,
  workspaceColumn: string,
  projectColumn: string,
  state: CompileState
): string => {
  if (!state.projectId) {
    if (state.projectScope === 'project') {
      throw new UnsupportedEntityQueryIRError(
        "projectScope 'project' requires EntityQuery.projectId to be set"
      );
    }
    return `${projectColumn} IS NULL`;
  }

  const ownedProjectParam = addParam(state, state.projectId);
  if (state.projectScope === 'project') {
    const linkedProjectParam = addParam(state, state.projectId);
    return (
      `(${projectColumn} = ${ownedProjectParam} OR EXISTS (` +
      `SELECT 1 FROM project_entity pe ` +
      `WHERE pe.workspace = ${workspaceColumn} ` +
      `AND pe.project_id = ${linkedProjectParam} ` +
      `AND pe.entity_id = ${entityIdColumn}))`
    );
  }

  return `(${projectColumn} IS NULL OR ${projectColumn} = ${ownedProjectParam})`;
};

const stateText = (stateColumn: string, fieldId: string, dialect: EntityQueryDialect): string => {
  if (dialect === 'postgres') {
    const value = `${stateColumn}->>'${fieldId}'`;
    return fieldId === 'project_id' ? `NULLIF(${value}, '')::uuid` : value;
  }
  return `json_extract(${stateColumn}, '$.${fieldId}')`;
};

const stateJson = (stateColumn: string, fieldId: string, dialect: EntityQueryDialect): string =>
  dialect === 'postgres'
    ? `${stateColumn}->'${fieldId}'`
    : `json_extract(${stateColumn}, '$.${fieldId}')`;

const liveEntityState = (dialect: EntityQueryDialect): string =>
  dialect === 'postgres'
    ? `jsonb_build_object(
        'id', e.id,
        'public_id', e.public_id,
        'slug', e.slug,
        'namespace', e.namespace,
        'name', e.name,
        'description', e.description,
        'owner', e.owner,
        'lifecycle', e.lifecycle,
        'target_lifecycle', e.target_lifecycle,
        'target_lifecycle_date', e.target_lifecycle_date,
        'tags', e.tags,
        'links', e.links,
        'schema_id', e.schema_id,
        'data', e.data,
        'project_id', e.project_id,
        'version', e.version,
        'completeness', e.completeness,
        'created_at', e.created_at,
        'updated_at', e.updated_at
      )`
    : `json_object(
        'id', e.id,
        'public_id', e.public_id,
        'slug', e.slug,
        'namespace', e.namespace,
        'name', e.name,
        'description', e.description,
        'owner', e.owner,
        'lifecycle', e.lifecycle,
        'target_lifecycle', e.target_lifecycle,
        'target_lifecycle_date', e.target_lifecycle_date,
        'tags', json(e.tags),
        'links', json(e.links),
        'schema_id', e.schema_id,
        'data', json(e.data),
        'project_id', e.project_id,
        'version', e.version,
        'completeness', e.completeness,
        'created_at', e.created_at,
        'updated_at', e.updated_at
      )`;

const temporalEntityProjection = (
  stateColumn: string,
  entityIdColumn: string,
  workspaceColumn: string,
  dialect: EntityQueryDialect
): string => {
  const text = (fieldId: string) => stateText(stateColumn, fieldId, dialect);
  const json = (fieldId: string) => stateJson(stateColumn, fieldId, dialect);
  const uuid = (fieldId: string) =>
    dialect === 'postgres' ? `NULLIF(${text(fieldId)}, '')::uuid` : text(fieldId);
  const emptyObject = dialect === 'postgres' ? "'{}'::jsonb" : "'{}'";
  const emptyArray = dialect === 'postgres' ? "'[]'::jsonb" : "'[]'";
  const entityIdText = dialect === 'postgres' ? `${entityIdColumn}::text` : entityIdColumn;

  return [
    `${entityIdColumn} AS id`,
    `${workspaceColumn} AS workspace`,
    `COALESCE(${text('public_id')}, ${entityIdText}) AS public_id`,
    `${text('slug')} AS slug`,
    `COALESCE(${text('namespace')}, 'default') AS namespace`,
    `COALESCE(${text('name')}, '') AS name`,
    `COALESCE(${text('description')}, '') AS description`,
    `${uuid('owner')} AS owner`,
    `${uuid('lifecycle')} AS lifecycle`,
    `${uuid('target_lifecycle')} AS target_lifecycle`,
    `${text('target_lifecycle_date')} AS target_lifecycle_date`,
    `COALESCE(${json('tags')}, ${emptyArray}) AS tags`,
    `COALESCE(${json('links')}, ${emptyArray}) AS links`,
    `${uuid('schema_id')} AS schema_id`,
    `COALESCE(${json('data')}, ${emptyObject}) AS data`,
    `${text('project_id')} AS project_id`,
    `${text('created_at')} AS created_at`,
    `${text('updated_at')} AS updated_at`,
    `COALESCE(${text('version')}, '1') AS version`,
    // Versions written before #2346 have no frozen completeness in their state JSON; default to 0
    // rather than surface NULL through a column callers otherwise treat as always-present.
    `COALESCE(${text('completeness')}, '0') AS completeness`,
    `COALESCE(${json('generated_metadata')}, ${emptyObject}) AS generated_metadata`,
    `${text('approval_policy_override')} AS approval_policy_override`
  ].join(',\n      ');
};

const buildTemporalSource = (state: CompileState): string => {
  const asOf = state.asOf!;
  const workspaceParam = addParam(state, state.workspace);
  const asOfParam = addParam(state, asOf.toISOString());
  const projectClause = projectScopeClause(
    'v.record_id',
    'v.workspace',
    stateText('v.state', 'project_id', state.dialect),
    state
  );
  const mergeStates =
    state.dialect === 'postgres'
      ? 'future_state.state || event.proposed_state'
      : 'json_patch(future_state.state, event.proposed_state)';
  const initialEventNumber = state.dialect === 'postgres' ? '0::bigint' : '0';

  const stateProjectColumn = (column: string) => stateText(column, 'project_id', state.dialect);
  const temporalProjection = temporalEntityProjection(
    'final_state.state',
    'final_state.entity_id',
    'final_state.workspace',
    state.dialect
  );

  const fallbackWorkspaceParam = addParam(state, state.workspace);
  const fallbackCreatedParam = addParam(state, asOf.toISOString());
  const fallbackProjectClause = projectScopeClause('e.id', 'e.workspace', 'e.project_id', state);
  const eventWorkspaceParam = addParam(state, state.workspace);
  const eventCreatedParam = addParam(state, asOf.toISOString());
  const eventDateParam = addParam(state, asOf.toISOString().slice(0, 10));
  const caseProjectClause =
    state.projectScope === 'project' && state.projectId && state.includePlannedChanges
      ? `(c.project_id IS NULL OR c.project_id = ${addParam(state, state.projectId)})`
      : 'c.project_id IS NULL';
  const temporalScopeClause = projectScopeClause(
    'final_state.entity_id',
    'final_state.workspace',
    stateProjectColumn('final_state.state'),
    state
  );
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `final_state.entity_id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const temporalScope = `${temporalScopeClause} AND ${visibleClause || '1=1'}`;

  return `
    latest_entity_version AS (
      SELECT v.*,
             ROW_NUMBER() OVER (
               PARTITION BY v.record_id
               ORDER BY v.created_at DESC, v.version_number DESC
             ) AS row_number
      FROM record_version v
      -- record_version is shared with relation instances (#2687) — without this join, a
      -- relation's version rows would be reconstructed as phantom near-empty "entities" here.
      JOIN catalog_record cr ON cr.id = v.record_id AND cr.kind = 'entity'
      WHERE v.workspace = ${workspaceParam}
        AND v.created_at <= ${asOfParam}
    ),
    baseline_entity_state AS (
      SELECT v.record_id AS entity_id, v.workspace, v.state
      FROM latest_entity_version v
      WHERE v.row_number = 1
        AND v.kind <> 'deleted'
        AND ${projectClause}
      UNION ALL
      SELECT e.id, e.workspace, ${liveEntityState(state.dialect)}
      FROM catalog_record e
      WHERE e.kind = 'entity'
        AND e.workspace = ${fallbackWorkspaceParam}
        AND e.deleted_at IS NULL
        AND e.created_at <= ${fallbackCreatedParam}
        AND NOT EXISTS (
          SELECT 1 FROM record_version any_version
          WHERE any_version.workspace = e.workspace
            AND any_version.record_id = e.id
        )
        AND ${fallbackProjectClause}
    ),
    active_future_events AS (
      SELECT m.record_id AS entity_id,
             c.id AS case_id,
             c.effective_date,
             r.created_at,
             r.revision_number,
             m.proposed_state,
             ROW_NUMBER() OVER (
               PARTITION BY m.record_id
               ORDER BY c.effective_date, r.created_at, r.revision_number, c.id
             ) AS event_number
      FROM record_change_case_record_version m
      JOIN entity_change_case_revision r
        ON r.id = m.revision_id
       AND r.is_active = ${state.dialect === 'postgres' ? 'TRUE' : '1'}
      JOIN entity_change_case c ON c.id = r.case_id
      WHERE c.workspace = ${eventWorkspaceParam}
        AND c.status IN ('planned', 'in_approval')
        AND r.status IN ('draft', 'submitted', 'changes_requested')
        AND r.created_at <= ${eventCreatedParam}
        AND c.effective_date IS NOT NULL
        AND c.effective_date <= ${eventDateParam}
        AND ${caseProjectClause}
    ),
    future_state (entity_id, workspace, state, event_number) AS (
      SELECT b.entity_id, b.workspace, b.state, ${initialEventNumber}
      FROM baseline_entity_state b
      UNION ALL
      SELECT future_state.entity_id,
             future_state.workspace,
             ${mergeStates},
             event.event_number
      FROM future_state
      JOIN active_future_events event
        ON event.entity_id = future_state.entity_id
       AND event.event_number = future_state.event_number + 1
    ),
    final_state AS (
      SELECT entity_id, workspace, state,
             ROW_NUMBER() OVER (
               PARTITION BY entity_id
               ORDER BY event_number DESC
             ) AS row_number
      FROM future_state
    ),
    temporal_entity_source AS (
      SELECT ${temporalProjection}
      FROM final_state
      WHERE final_state.row_number = 1
        AND ${temporalScope}
    )`;
};

// Builds the one source CTE consumed by every traversal alias. Live queries use entity directly;
// temporal queries reconstruct a JSON state in SQL from entity_version and active future cases,
// then project that state into the same entity-shaped columns expected by the result mapper.
const buildScopeCte = (state: CompileState): string => {
  const hasAssessment = state.assessmentId != null;
  const assessmentColumn = hasAssessment
    ? `ar."values" AS assessment_values`
    : state.dialect === 'postgres'
      ? 'NULL::jsonb AS assessment_values'
      : 'NULL AS assessment_values';
  const source = state.asOf ? buildTemporalSource(state) : '';

  if (state.asOf) {
    const assessmentParam = hasAssessment ? addParam(state, state.assessmentId) : null;
    return `${source},\n    ${SCOPE_CTE} AS (\n      SELECT s.*, ${assessmentColumn}\n      FROM temporal_entity_source s\n      LEFT JOIN assessment_response ar\n        ON ar.entity_id = s.id\n       AND ar.assessment_id = ${assessmentParam ?? 'NULL'}\n       AND ar.workspace = s.workspace\n    )`;
  }

  const assessmentParam = hasAssessment ? addParam(state, state.assessmentId) : null;
  const workspaceParam = addParam(state, state.workspace);
  const scopeClause = projectScopeClause('e.id', 'e.workspace', 'e.project_id', state);
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `e.id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const scopedWhere = `${scopeClause} AND ${visibleClause || '1=1'}`;
  return `${SCOPE_CTE} AS (\n      SELECT e.*, ${assessmentColumn}\n      FROM catalog_record e\n      LEFT JOIN assessment_response ar\n        ON ar.entity_id = e.id\n       AND ar.assessment_id = ${assessmentParam ?? 'NULL'}\n       AND ar.workspace = e.workspace\n      WHERE e.kind = 'entity'\n        AND e.workspace = ${workspaceParam}\n        AND e.deleted_at IS NULL\n        AND ${scopedWhere}\n    )`;
};

// JSON/JSONB shape matching relationToBaseState (relationHelpers.ts) — this is exactly what
// relationOperations.ts writes into record_version.state for a relation, so the live fallback
// branch below and the version-history branch in buildTemporalRelationSource produce identically
// shaped rows for temporalRelationProjection to read uniformly.
const liveRelationState = (dialect: EntityQueryDialect): string =>
  dialect === 'postgres'
    ? `jsonb_build_object(
        'id', r.id,
        'workspace', r.workspace,
        'schema_id', r.schema_id,
        'in_entity_id', r.in_record_id,
        'out_entity_id', r.out_record_id,
        'data', r.data,
        'version', r.version,
        'approval_policy_override', r.approval_policy_override,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )`
    : `json_object(
        'id', r.id,
        'workspace', r.workspace,
        'schema_id', r.schema_id,
        'in_entity_id', r.in_record_id,
        'out_entity_id', r.out_record_id,
        'data', json(r.data),
        'version', r.version,
        'approval_policy_override', r.approval_policy_override,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )`;

const temporalRelationProjection = (
  stateColumn: string,
  recordIdColumn: string,
  workspaceColumn: string,
  dialect: EntityQueryDialect
): string => {
  const text = (fieldId: string) => stateText(stateColumn, fieldId, dialect);
  const json = (fieldId: string) => stateJson(stateColumn, fieldId, dialect);
  const uuid = (fieldId: string) =>
    dialect === 'postgres' ? `NULLIF(${text(fieldId)}, '')::uuid` : text(fieldId);
  const emptyObject = dialect === 'postgres' ? "'{}'::jsonb" : "'{}'";

  return [
    `${recordIdColumn} AS id`,
    `${workspaceColumn} AS workspace`,
    `${uuid('schema_id')} AS schema_id`,
    `${uuid('in_entity_id')} AS in_record_id`,
    `${uuid('out_entity_id')} AS out_record_id`,
    `COALESCE(${json('data')}, ${emptyObject}) AS data`,
    `COALESCE(${text('version')}, '1') AS version`,
    `${text('approval_policy_override')} AS approval_policy_override`,
    `${text('created_at')} AS created_at`,
    `${text('updated_at')} AS updated_at`
  ].join(',\n      ');
};

// Relation-instance counterpart of buildTemporalSource. Simpler than the entity version: relations
// have no planned-changes/change-case layering yet (#2687 excludes it), so this is just "latest
// version at or before asOf" with a live-row fallback for relations that predate version tracking
// — no future_state overlay needed.
const buildTemporalRelationSource = (state: CompileState): string => {
  const asOf = state.asOf!;
  const workspaceParam = addParam(state, state.workspace);
  const asOfParam = addParam(state, asOf.toISOString());
  const fallbackWorkspaceParam = addParam(state, state.workspace);
  const fallbackCreatedParam = addParam(state, asOf.toISOString());
  const projection = temporalRelationProjection(
    'final_relation_state.state',
    'final_relation_state.record_id',
    'final_relation_state.workspace',
    state.dialect
  );

  return `
    latest_relation_version AS (
      SELECT v.*,
             ROW_NUMBER() OVER (
               PARTITION BY v.record_id
               ORDER BY v.created_at DESC, v.version_number DESC
             ) AS row_number
      FROM record_version v
      -- record_version is shared with entities — restrict to relation-owned versions only.
      JOIN catalog_record cr ON cr.id = v.record_id AND cr.kind = 'relation'
      WHERE v.workspace = ${workspaceParam}
        AND v.created_at <= ${asOfParam}
    ),
    final_relation_state AS (
      SELECT v.record_id, v.workspace, v.state
      FROM latest_relation_version v
      WHERE v.row_number = 1
        AND v.kind <> 'deleted'
      UNION ALL
      SELECT r.id, r.workspace, ${liveRelationState(state.dialect)}
      FROM catalog_record r
      WHERE r.kind = 'relation'
        AND r.workspace = ${fallbackWorkspaceParam}
        AND r.deleted_at IS NULL
        AND r.created_at <= ${fallbackCreatedParam}
        AND NOT EXISTS (
          SELECT 1 FROM record_version any_version
          WHERE any_version.workspace = r.workspace
            AND any_version.record_id = r.id
        )
    ),
    temporal_relation_source AS (
      SELECT ${projection}
      FROM final_relation_state
    )`;
};

// Relation-instance counterpart of buildScopeCte. Live queries read catalog_record directly;
// temporal queries reconstruct relation state from record_version via buildTemporalRelationSource.
const buildRelationScopeCte = (state: CompileState): string => {
  if (state.asOf) {
    return `${buildTemporalRelationSource(state)},\n    ${RELATION_SCOPE_CTE} AS (\n      SELECT * FROM temporal_relation_source\n    )`;
  }
  const workspaceParam = addParam(state, state.workspace);
  const visibleClause =
    state.visibleRelationIds == null
      ? ''
      : state.visibleRelationIds.length === 0
        ? '1=0'
        : `r.id IN (${state.visibleRelationIds.map(id => addParam(state, id)).join(', ')})`;
  return `${RELATION_SCOPE_CTE} AS (\n      SELECT r.*\n      FROM catalog_record r\n      WHERE r.kind = 'relation'\n        AND r.workspace = ${workspaceParam}\n        AND r.deleted_at IS NULL\n        AND ${visibleClause || '1=1'}\n    )`;
};

// Shared setup for compileEntityQueryIR and compileEntityQueryCountIR: resolves rootKind, builds
// the CompileState, the scope/projection CTEs, and the WHERE clause. Both the row query and the
// count query filter on exactly the same WHERE clause, so factoring this out keeps them from
// silently diverging.
const buildQueryFragments = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions,
  authCtx: WorkspaceAuthorizationContext | null,
  relationSchemas: RelationSchemaCatalog
) => {
  // Resolves the same way entityQueryIRValidator.ts's resolveRootKind does: schemaId, when
  // present, is looked up against both registries and wins; callers must have already validated
  // the query, so a schemaId that resolves to neither registry can't occur here.
  const rootKind: 'entity' | 'relation' = query.schemaId
    ? relationSchemas.has(query.schemaId) && !schemas.has(query.schemaId)
      ? 'relation'
      : 'entity'
    : (query.root_kind ?? 'entity');

  const state: CompileState = {
    dialect,
    workspace,
    authCtx,
    relationSchemas,
    rootKind,
    assessmentId: query.assessmentId,
    projectId: query.projectId,
    projectScope: query.projectScope ?? 'all',
    asOf: query.asOf ? new Date(query.asOf) : null,
    includePlannedChanges: query.includePlannedChanges ?? true,
    params: [],
    nextAliasIndex: 1,
    nextRelationAliasIndex: 1,
    projectionBindings: [],
    bindingByPath: new Map(),
    compilingBinding: false,
    visibleEntityIds: options.visibleEntityIds,
    visibleRelationIds: options.visibleRelationIds,
    limit: options.limit,
    offset: options.offset
  };

  if (state.asOf && Number.isNaN(state.asOf.getTime())) {
    throw new UnsupportedEntityQueryIRError(`Invalid asOf date '${query.asOf}'`);
  }

  const cte = buildScopeCte(state);
  const relationCte = buildRelationScopeCte(state);
  const projectionCtes = buildProjectionBindings(query, schemas, relationSchemas, state);
  const projectionObject = compileProjectionObject(query.projections ?? [], schemas, state);
  const whereParts: string[] = [];
  if (query.schemaId) {
    whereParts.push(`${ROOT_ALIAS}.schema_id = ${addParam(state, query.schemaId)}`);
  }
  whereParts.push(compileNode(query.root, ROOT_ALIAS, schemas, relationSchemas, state, true));

  const withClause = `WITH${state.asOf ? ' RECURSIVE' : ''} ${cte},\n    ${relationCte}${projectionCtes.length > 0 ? `,\n    ${projectionCtes.join(',\n    ')}` : ''}`;

  return { rootKind, state, withClause, whereParts, projectionObject };
};

// Compiles a validated EntityQuery into a full `WITH scoped_entity AS (...) SELECT ...` statement,
// joining the same denormalized owner/lifecycle/schema-name columns `ENTITY_SELECT_SQL`
// (catalogDatabase.ts) already attaches for a live entity row. Callers must validate the query
// first (entityQueryIRValidator.ts) — this function assumes a structurally valid IR and does not
// re-check hop counts or backward-step ownership.
export const compileEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery => {
  const { rootKind, state, withClause, whereParts, projectionObject } = buildQueryFragments(
    query,
    schemas,
    dialect,
    workspace,
    options,
    authCtx,
    relationSchemas
  );

  // Only the relation-rooted branch pushes LIMIT/OFFSET into SQL today (#2700) — the entity-rooted
  // branch still relies on collect-then-slice in JS because collectEntitiesFromIR applies a
  // JS-only post-filter (collectionEntityIds) after this query runs, which SQL LIMIT/OFFSET would
  // silently under-fill against. See #2713 for lifting that restriction.
  const limitOffsetClause =
    rootKind === 'relation' && state.limit != null
      ? `\n    LIMIT ${addParam(state, state.limit)}${state.offset != null ? ` OFFSET ${addParam(state, state.offset)}` : ''}`
      : '';

  const sql =
    rootKind === 'relation'
      ? `
    ${withClause}
    SELECT ${ROOT_ALIAS}.*,
      ${ROOT_ALIAS}.in_record_id  AS in_entity_id,
      ${ROOT_ALIAS}.out_record_id AS out_entity_id,
      rs.name    AS schema_name,
      in_e.name  AS in_entity_name,
      out_e.name AS out_entity_name,
      ${projectionObject} AS projections
    FROM ${RELATION_SCOPE_CTE} ${ROOT_ALIAS}
    JOIN relation_schema rs        ON rs.id = ${ROOT_ALIAS}.schema_id
    LEFT JOIN catalog_record in_e  ON in_e.id = ${ROOT_ALIAS}.in_record_id
    LEFT JOIN catalog_record out_e ON out_e.id = ${ROOT_ALIAS}.out_record_id
    WHERE ${whereParts.join(' AND ')}
    ORDER BY in_e.name, out_e.name, ${ROOT_ALIAS}.id${limitOffsetClause}
  `
      : `
    ${withClause}
    SELECT ${ROOT_ALIAS}.*,
      wo.name   AS owner_name,
      ls.label  AS lifecycle_label,
      tls.label AS target_lifecycle_label,
      es.name   AS schema_name,
      ${projectionObject} AS projections
    FROM ${SCOPE_CTE} ${ROOT_ALIAS}
    LEFT JOIN workspace_owner wo            ON wo.id  = ${ROOT_ALIAS}.owner
    LEFT JOIN workspace_lifecycle_state ls  ON ls.id  = ${ROOT_ALIAS}.lifecycle
    LEFT JOIN workspace_lifecycle_state tls ON tls.id = ${ROOT_ALIAS}.target_lifecycle
    JOIN entity_schema es ON es.id = ${ROOT_ALIAS}.schema_id
    WHERE ${whereParts.join(' AND ')}
    ORDER BY ${ROOT_ALIAS}.name, ${ROOT_ALIAS}.id
  `;

  return { sql, params: state.params };
};

// Compiles the same relation-rooted query as compileEntityQueryIR but as a `SELECT COUNT(*)`
// instead of row data, with no ORDER BY/LIMIT/OFFSET — used to compute an accurate `total` for
// paginated relation queries (#2700) without collecting every row into memory. Entity-rooted
// counting still goes through the JS collect-then-.length path (see #2713).
export const compileEntityQueryCountIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery => {
  const { rootKind, state, withClause, whereParts } = buildQueryFragments(
    query,
    schemas,
    dialect,
    workspace,
    options,
    authCtx,
    relationSchemas
  );

  if (rootKind !== 'relation') {
    throw new UnsupportedEntityQueryIRError(
      'compileEntityQueryCountIR only supports relation-rooted queries'
    );
  }

  const sql = `
    ${withClause}
    SELECT COUNT(*) AS count
    FROM ${RELATION_SCOPE_CTE} ${ROOT_ALIAS}
    JOIN relation_schema rs        ON rs.id = ${ROOT_ALIAS}.schema_id
    LEFT JOIN catalog_record in_e  ON in_e.id = ${ROOT_ALIAS}.in_record_id
    LEFT JOIN catalog_record out_e ON out_e.id = ${ROOT_ALIAS}.out_record_id
    WHERE ${whereParts.join(' AND ')}
  `;

  return { sql, params: state.params };
};
