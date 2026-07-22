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
import type { SchemaCatalog } from './entityQueryIRValidator';

export type EntityQueryDialect = 'postgres' | 'sqlite';

export type CompiledEntityQuery = { sql: string; params: unknown[] };

export type CompiledEntityQueryOptions = {
  visibleEntityIds?: readonly string[];
};

// Raised for a fieldId/op combination that has no SQL translation in this dialect today —
// `_completeness` (computed post-fetch from schema + data) is the same hybrid-seam fallback
// category `entityQueryOperations.ts` already has for flat conditions (specs/QUERY_LANGUAGE.md §9);
// wiring that fallback into this compiler's caller is follow-up work, not something this compiler
// should silently paper over. `_assessment`/`_assessment:<fieldId>` ARE supported in SQL (below),
// unlike completeness — `assessment_response` is a real, normalized, entity_id-keyed table, not an
// in-memory-only computation.
export class UnsupportedEntityQueryIRError extends Error {}

// Every alias (root and every hop) is drawn from this CTE rather than the raw `entity` table, so
// there is exactly one place that defines "which entities/rows are in scope for this query" —
// workspace, soft-delete, and (later) project-scoping or asOf point-in-time reconstruction all
// become a change to this one CTE body rather than to every join/EXISTS this compiler emits.
// It also joins the query's single joined assessment (if any) once, so `_assessment*` predicates
// at any traversal position read a plain column (`assessment_values`) instead of each needing their
// own correlated subquery.
const SCOPE_CTE = 'scoped_entity';
const ROOT_ALIAS = 'e0';

type CompileState = {
  dialect: EntityQueryDialect;
  workspace: string;
  assessmentId: string | undefined;
  projectId: string | undefined;
  projectScope: 'project' | 'all';
  asOf: Date | null;
  includeProjectSnapshots: boolean;
  params: unknown[];
  nextAliasIndex: number;
  projectionBindings: ProjectionBinding[];
  bindingByPath: Map<string, ProjectionBinding>;
  compilingBinding: boolean;
  visibleEntityIds?: readonly string[];
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

const relationIsMultiValued = (path: PathStep[], schemas: SchemaCatalog): boolean =>
  path.some(step => {
    const fields =
      step.kind === 'backward'
        ? [schemas.get(step.ownerSchemaId)?.fields.find(field => field.id === step.fieldId)]
        : [...schemas.values()].map(schema =>
            schema.fields.find(field => field.id === step.fieldId)
          );
    return fields.some(
      field =>
        (field?.type === 'reference' || field?.type === 'containment') && field.maxCount !== 1
    );
  });

const effectiveProjectionAlias = (projection: ProjectionField): string => {
  if (projection.alias) return projection.alias;
  const path = projection.path
    .map(step =>
      step.kind === 'forward' ? step.fieldId : `<-${step.ownerSchemaId}.${step.fieldId}`
    )
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
  if (fieldId === '_completeness') return null;
  if (!isValidFieldId(fieldId)) return null;
  return {
    col:
      dialect === 'postgres'
        ? `(${alias}.data->>'${fieldId}')`
        : `json_extract(${alias}.data, '$.${fieldId}')`,
    kind: 'scalar'
  };
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
      throw new UnsupportedEntityQueryIRError(
        `Field '${fieldId}' has no SQL translation (completeness fields require in-memory evaluation)`
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
// the identical joined row, not a separately-joined copy. Every hop is drawn `FROM scoped_entity`,
// not `FROM entity` — workspace/soft-delete/project scoping is already baked into that CTE.
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
  // Must be evaluated (not just concatenated) in the same left-to-right order its placeholder
  // appears in the returned SQL text — addParam pushes onto state.params as a side effect, so
  // evaluation order and placeholder order must match or params end up transposed.
  const ownerSchemaClause =
    step.kind === 'backward'
      ? ` AND ${alias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
      : '';
  const filterClause = step.filter ? ` AND ${compileNode(step.filter, alias, schemas, state)}` : '';
  const rest = compilePathSteps(steps, index + 1, alias, schemas, state, terminal);

  return (
    `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${joinClause}${ownerSchemaClause}` +
    `${filterClause} AND ${rest})`
  );
};

const compileBoundNode = (
  node: Extract<QueryNode, { kind: 'predicate' | 'relationExists' }>,
  alias: string,
  binding: ProjectionBinding,
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
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(pathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, state);
      }
      return compilePathSteps(
        node.path,
        0,
        alias,
        schemas,
        state,
        compilePredicateTerminal(node.fieldId, node.op, node.value, state.dialect, state)
      );
    case 'relationExists':
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(pathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, state);
      }
      return compilePathSteps(node.path, 0, alias, schemas, state, () => '1=1');
  }
};

const buildProjectionBindings = (
  query: EntityQuery,
  schemas: SchemaCatalog,
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
    if (candidates.length > 1 && relationIsMultiValued(projection.path, schemas)) {
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
    let from = `FROM ${SCOPE_CTE} ${rootAlias}`;

    state.compilingBinding = true;
    binding.path.forEach((step, stepIndex) => {
      const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
      const relation =
        step.kind === 'forward'
          ? relationJoinClause(currentAlias, step.fieldId, targetAlias, state.dialect)
          : relationJoinClause(targetAlias, step.fieldId, currentAlias, state.dialect);
      const ownerSchema =
        step.kind === 'backward'
          ? ` AND ${targetAlias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
          : '';
      const filter = step.filter
        ? ` AND ${compileNode(step.filter, targetAlias, schemas, state)}`
        : '';
      from += `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${relation}${ownerSchema}${filter}`;
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
  if (fieldId === '_completeness') {
    throw new UnsupportedEntityQueryIRError(
      "Projection field '_completeness' requires in-memory evaluation"
    );
  }
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
  const isArray = relationIsMultiValued(projection.path, schemas);
  const binding = projectionBindingFor(projection, state);
  if (!binding) {
    return {
      value: projectionRawValue(ROOT_ALIAS, projection.fieldId, state.dialect),
      isArray: false
    };
  }

  const bindingAlias = `pv_${binding.name}`;
  const targetAlias = `pv_target_${binding.name}`;
  const targetId = `${bindingAlias}.hop_${projection.path.length}_id`;
  const raw = projectionRawValue(targetAlias, projection.fieldId, state.dialect);
  const source =
    `FROM ${binding.name} ${bindingAlias} ` +
    `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} ` +
    `WHERE ${bindingAlias}.root_id = ${ROOT_ALIAS}.id`;

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
    const key = addParam(state, effectiveProjectionAlias(projection));
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
  column: string,
  state: CompileState,
  allowProjectScope: boolean
): string => {
  if (state.projectScope !== 'project') return `${column} IS NULL`;
  if (!state.projectId) {
    throw new UnsupportedEntityQueryIRError(
      "projectScope 'project' requires EntityQuery.projectId to be set"
    );
  }
  return allowProjectScope
    ? `(${column} IS NULL OR ${column} = ${addParam(state, state.projectId)})`
    : `${column} IS NULL`;
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
    `${text('owner')} AS owner`,
    `${text('lifecycle')} AS lifecycle`,
    `${text('target_lifecycle')} AS target_lifecycle`,
    `${text('target_lifecycle_date')} AS target_lifecycle_date`,
    `COALESCE(${json('tags')}, ${emptyArray}) AS tags`,
    `COALESCE(${json('links')}, ${emptyArray}) AS links`,
    `${text('schema_id')} AS schema_id`,
    `COALESCE(${json('data')}, ${emptyObject}) AS data`,
    `${text('project_id')} AS project_id`,
    `${text('created_at')} AS created_at`,
    `${text('updated_at')} AS updated_at`,
    `COALESCE(${text('version')}, '1') AS version`,
    `COALESCE(${json('generated_metadata')}, ${emptyObject}) AS generated_metadata`,
    `${text('approval_policy_override')} AS approval_policy_override`
  ].join(',\n      ');
};

const buildTemporalSource = (state: CompileState): string => {
  const asOf = state.asOf!;
  const workspaceParam = addParam(state, state.workspace);
  const asOfParam = addParam(state, asOf.toISOString());
  const projectClause = projectScopeClause(
    stateText('v.state', 'project_id', state.dialect),
    state,
    true
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
  const fallbackProjectClause = projectScopeClause('e.project_id', state, true);
  const eventWorkspaceParam = addParam(state, state.workspace);
  const eventCreatedParam = addParam(state, asOf.toISOString());
  const eventDateParam = addParam(state, asOf.toISOString().slice(0, 10));
  const caseProjectClause =
    state.projectScope === 'project' && state.projectId && state.includeProjectSnapshots
      ? `(c.project_id IS NULL OR c.project_id = ${addParam(state, state.projectId)})`
      : 'c.project_id IS NULL';
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `final_state.entity_id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const temporalScopeClause = `${projectScopeClause(stateProjectColumn('final_state.state'), state, true)} AND ${visibleClause || '1=1'}`;

  return `
    latest_entity_version AS (
      SELECT v.*,
             ROW_NUMBER() OVER (
               PARTITION BY v.entity_id
               ORDER BY v.created_at DESC, v.version_number DESC
             ) AS row_number
      FROM entity_version v
      WHERE v.workspace = ${workspaceParam}
        AND v.created_at <= ${asOfParam}
    ),
    baseline_entity_state AS (
      SELECT v.entity_id, v.workspace, v.state
      FROM latest_entity_version v
      WHERE v.row_number = 1
        AND v.kind <> 'deleted'
        AND ${projectClause}
      UNION ALL
      SELECT e.id, e.workspace, ${liveEntityState(state.dialect)}
      FROM entity e
      WHERE e.workspace = ${fallbackWorkspaceParam}
        AND e.deleted_at IS NULL
        AND e.created_at <= ${fallbackCreatedParam}
        AND NOT EXISTS (
          SELECT 1 FROM entity_version any_version
          WHERE any_version.workspace = e.workspace
            AND any_version.entity_id = e.id
        )
        AND ${fallbackProjectClause}
    ),
    active_future_events AS (
      SELECT m.entity_id,
             c.id AS case_id,
             c.effective_date,
             r.created_at,
             r.revision_number,
             m.proposed_state,
             ROW_NUMBER() OVER (
               PARTITION BY m.entity_id
               ORDER BY c.effective_date, r.created_at, r.revision_number, c.id
             ) AS event_number
      FROM entity_change_case_entity_version m
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
        AND ${temporalScopeClause}
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
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `e.id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const scopeClause = `${projectScopeClause('e.project_id', state, true)} AND ${visibleClause || '1=1'}`;
  return `${SCOPE_CTE} AS (\n      SELECT e.*, ${assessmentColumn}\n      FROM entity e\n      LEFT JOIN assessment_response ar\n        ON ar.entity_id = e.id\n       AND ar.assessment_id = ${assessmentParam ?? 'NULL'}\n       AND ar.workspace = e.workspace\n      WHERE e.workspace = ${workspaceParam}\n        AND e.deleted_at IS NULL\n        AND ${scopeClause}\n    )`;
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
  options: CompiledEntityQueryOptions = {}
): CompiledEntityQuery => {
  const state: CompileState = {
    dialect,
    workspace,
    assessmentId: query.assessmentId,
    projectId: query.projectId,
    projectScope: query.projectScope ?? 'all',
    asOf: query.asOf ? new Date(query.asOf) : null,
    includeProjectSnapshots: query.includeProjectSnapshots ?? true,
    params: [],
    nextAliasIndex: 1,
    projectionBindings: [],
    bindingByPath: new Map(),
    compilingBinding: false,
    visibleEntityIds: options.visibleEntityIds
  };

  if (state.asOf && Number.isNaN(state.asOf.getTime())) {
    throw new UnsupportedEntityQueryIRError(`Invalid asOf date '${query.asOf}'`);
  }

  const cte = buildScopeCte(state);
  const projectionCtes = buildProjectionBindings(query, schemas, state);
  const projectionObject = compileProjectionObject(query.projections ?? [], schemas, state);
  const whereParts: string[] = [];
  if (query.schemaId) {
    whereParts.push(`${ROOT_ALIAS}.schema_id = ${addParam(state, query.schemaId)}`);
  }
  whereParts.push(compileNode(query.root, ROOT_ALIAS, schemas, state));

  const sql = `
    WITH${state.asOf ? ' RECURSIVE' : ''} ${cte}${projectionCtes.length > 0 ? `,\n    ${projectionCtes.join(',\n    ')}` : ''}
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
