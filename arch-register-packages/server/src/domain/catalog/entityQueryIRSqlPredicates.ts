import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { isMultiValuedScalarField } from './entityScalarValues';
import type { PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import {
  ASSESSMENT_PRESENCE_FIELD_ID,
  ASSESSMENT_FIELD_PREFIX
} from '@arch-register/api-types/assessmentFilter';
import {
  ENTITY_BUILTIN_COLUMNS,
  ENTITY_ARRAY_COLUMNS,
  buildConditionClause,
  isValidFieldId
} from './db/filterBuilder';
import {
  kindAfterPath,
  relationFieldById,
  resolveEndpointSchemaIds,
  resolveFieldSchemaScope,
  resolveRelationFieldSchemaScope,
  schemaFieldById
} from './entityQueryIRResolution';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { entityQueryPathKey } from './entityQueryIRPlan';
import {
  addParam,
  ENTITY_CONFORMANCE_FIELD_IDS,
  nextAlias,
  nextRelationAlias,
  RELATION_SCOPE_CTE,
  ROOT_ALIAS,
  SCOPE_CTE,
  type EntityQuerySqlRenderState
} from './entityQueryIRSqlContext';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';

const buildConformanceStatusConditionClause = (
  fieldId: string,
  column: string,
  op: FilterCondition['op'],
  value: unknown,
  addParameter: (value: unknown) => string
): string | null => {
  if (fieldId !== '_conformanceStatus') return null;

  if (op === 'equals' && value === 'unresolved') {
    return `(${column} = ${addParameter('violating')} OR ${column} = ${addParameter('acknowledged')})`;
  }

  if (op === 'not_equals' && value === 'unresolved') {
    return `(${column} != ${addParameter('violating')} AND ${column} != ${addParameter('acknowledged')} OR ${column} IS NULL)`;
  }

  if (op === 'in' && Array.isArray(value) && value.includes('unresolved')) {
    const expandedValues = value.flatMap(item =>
      item === 'unresolved' ? ['violating', 'acknowledged'] : [item]
    );
    return expandedValues.length === 0
      ? '1=0'
      : `${column} IN (${expandedValues.map(item => addParameter(item)).join(', ')})`;
  }

  return null;
};

export const schemaScopeClause = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): string | null => {
  const scope = resolveFieldSchemaScope(fieldId, state.schemas, state.authCtx);
  if (!scope.needsScoping) return null;
  if (scope.grantedSchemaIds.size === 0) return '1=0';
  return `${alias}.schema_id IN (${[...scope.grantedSchemaIds]
    .map(id => addParam(state, id))
    .join(', ')})`;
};

// A field that is restricted for the current row is unknown to the caller, not false. Keeping the
// visibility check outside the predicate's boolean expression is important: `(predicate AND
// scope)` becomes false for an inaccessible row, and `NOT(false)` then incorrectly matches it.
// Returning SQL NULL preserves three-valued logic through NOT/AND/OR and therefore keeps the row
// out of a WHERE clause without allowing negation to turn restricted data into a match.
export const applyFieldVisibilityAsUnknown = (
  clause: string,
  scopeClause: string | null
): string => (scopeClause ? `(CASE WHEN ${scopeClause} THEN (${clause}) ELSE NULL END)` : clause);

export const projectionTargetSchemaClause = (
  alias: string,
  schemaIds: readonly string[],
  state: EntityQuerySqlRenderState
): string => {
  // Internal/system callers retain the existing unrestricted behavior, including for legacy
  // rows whose target schema metadata is unavailable.
  if (state.authCtx == null) return '';
  if (schemaIds.length === 0) return '1=0';
  return `${alias}.schema_id IN (${schemaIds.map(id => addParam(state, id)).join(', ')})`;
};

export const projectionEntityFieldSchemaClause = (
  alias: string,
  fieldId: string,
  schemaIds: readonly string[],
  state: EntityQuerySqlRenderState
): string | null => {
  if (state.authCtx == null) return null;

  // Metadata and assessment pseudo-fields are not declared in entity schemas. The enclosing
  // target-schema join still prevents a missing target schema from contributing a value.
  if (
    fieldId === '_id' ||
    ENTITY_CONFORMANCE_FIELD_IDS.has(fieldId) ||
    fieldId === ASSESSMENT_PRESENCE_FIELD_ID ||
    fieldId.startsWith(ASSESSMENT_FIELD_PREFIX) ||
    Object.hasOwn(ENTITY_BUILTIN_COLUMNS, fieldId) ||
    Object.hasOwn(ENTITY_ARRAY_COLUMNS, fieldId)
  ) {
    return null;
  }

  const targetSchemas = new Map(
    schemaIds.flatMap(schemaId => {
      const schema = state.schemas.get(schemaId);
      return schema ? [[schemaId, schema] as const] : [];
    })
  );
  const grantedSchemaIds = [...targetSchemas.values()]
    .filter(schema => schemaFieldById(schema, fieldId) != null)
    .filter(schema => !isFieldViewRestricted(state.authCtx, schema, fieldId))
    .map(schema => schema.id);

  if (grantedSchemaIds.length === 0) return '1=0';
  return `${alias}.schema_id IN (${grantedSchemaIds.map(id => addParam(state, id)).join(', ')})`;
};

// Relation-schema counterpart to schemaScopeClause, for relation-rooted predicates/projections.
export const relationSchemaScopeClause = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): string | null => {
  const scope = resolveRelationFieldSchemaScope(fieldId, state.relationSchemas, state.authCtx);
  if (!scope.needsScoping) return null;
  if (scope.grantedSchemaIds.size === 0) return '1=0';
  return `${alias}.schema_id IN (${[...scope.grantedSchemaIds]
    .map(id => addParam(state, id))
    .join(', ')})`;
};

export const typedRelationOwnerSchemaClause = (
  alias: string,
  ownerSchemaIds: readonly string[],
  state: EntityQuerySqlRenderState
): string => {
  if (ownerSchemaIds.length === 0) return '1=0';
  return `${alias}.schema_id IN (${ownerSchemaIds.map(id => addParam(state, id)).join(', ')})`;
};

export const unboundTypedRelationOwnerSchemaClause = (
  alias: string,
  relationSchemaId: string,
  direction: 'in' | 'out',
  state: EntityQuerySqlRenderState
): string => {
  const relationSchema = state.relationSchemas.get(relationSchemaId);
  const endpointSchemaIds =
    direction === 'in' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
  const ownerSchemaIds = [...resolveEndpointSchemaIds(endpointSchemaIds, state.schemas)].filter(
    id => state.schemas.has(id)
  );
  return typedRelationOwnerSchemaClause(alias, ownerSchemaIds, state);
};

const requireAssessmentId = (state: EntityQuerySqlRenderState): void => {
  if (!state.assessmentId) {
    throw new UnsupportedEntityQueryIRError(
      "'_assessment'/'_assessment:<fieldId>' predicates require EntityQuery.assessmentId to be set"
    );
  }
};

// `_assessment` (presence pseudo-field): mirrors `matchesAssessmentConditions`'s handling in
// assessmentFilter.ts — only `empty`/`not_empty` are meaningful; any other op is vacuously true,
// matching that function's existing fallback for ops it doesn't special-case.
const compileAssessmentPresence = (
  alias: string,
  op: FilterCondition['op'],
  state: EntityQuerySqlRenderState
): string => {
  requireAssessmentId(state);
  if (op === 'not_empty') return `${alias}.assessment_values IS NOT NULL`;
  if (op === 'empty') return `${alias}.assessment_values IS NULL`;
  return '1=1';
};

const assessmentFieldColumn = (
  alias: string,
  assessmentFieldId: string,
  state: EntityQuerySqlRenderState
): string => {
  requireAssessmentId(state);
  assertValidFieldId(assessmentFieldId);
  return state.dialectAdapter.jsonFieldText(`${alias}.assessment_values`, assessmentFieldId);
};

const resolveColumn = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState,
  kind: 'scalar' | 'array' | 'currency-array' = 'scalar',
  currencyAmount = false
): { col: string; kind: 'scalar' | 'array' | 'currency-array' } | null => {
  if (fieldId === '_id') return { col: `${alias}.id`, kind: 'scalar' };
  if (fieldId === '_conformanceStatus') {
    return { col: `${alias}.conformance_status`, kind: 'scalar' };
  }
  if (fieldId === '_conformanceEvaluatedAt') {
    return { col: `${alias}.conformance_evaluated_at`, kind: 'scalar' };
  }
  if (fieldId === '_conformanceStale') {
    return { col: `${alias}.conformance_stale`, kind: 'scalar' };
  }
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
  if (kind === 'array' || kind === 'currency-array') {
    return {
      col: state.dialectAdapter.jsonFieldValue(`${alias}.data`, fieldId),
      kind
    };
  }
  if (currencyAmount) {
    return {
      col: state.dialectAdapter.jsonPathText(`${alias}.data`, [fieldId, 'amount']),
      kind: 'scalar'
    };
  }
  return {
    col: state.dialectAdapter.jsonFieldText(`${alias}.data`, fieldId),
    kind: 'scalar'
  };
};

export const assertValidFieldId = (fieldId: string): void => {
  if (!isValidFieldId(fieldId)) {
    throw new UnsupportedEntityQueryIRError(`Invalid field id '${fieldId}'`);
  }
};

export const relationJoinClause = (
  ownerAlias: string,
  fieldId: string,
  targetAlias: string,
  state: EntityQuerySqlRenderState
): string => {
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonArrayContains(ownerAlias, fieldId, targetAlias);
};

export const jsonArrayElementPosition = (
  ownerAlias: string,
  fieldId: string,
  targetId: string,
  state: EntityQuerySqlRenderState
): string => {
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonArrayElementPosition(ownerAlias, fieldId, targetId);
};

export const jsonArrayLateralElement = (
  ownerAlias: string,
  fieldId: string,
  elementAlias: string,
  state: EntityQuerySqlRenderState
) => {
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonArrayLateralElement(ownerAlias, fieldId, elementAlias);
};

const compilePredicateTerminal =
  (fieldId: string, op: FilterCondition['op'], value: unknown, state: EntityQuerySqlRenderState) =>
  (alias: string): string => {
    if (fieldId === ASSESSMENT_PRESENCE_FIELD_ID) {
      return compileAssessmentPresence(alias, op, state);
    }

    const scalarFields = [...state.schemas.values()]
      .map(schema => schemaFieldById(schema, fieldId))
      .filter((field): field is NonNullable<typeof field> => field != null);
    const multiField = scalarFields.find(field => isMultiValuedScalarField(field));
    const fieldKind = multiField
      ? multiField.type === 'currency'
        ? ('currency-array' as const)
        : ('array' as const)
      : ('scalar' as const);
    const currencyAmount =
      fieldKind === 'scalar' && scalarFields.some(field => field.type === 'currency');
    const resolved = fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)
      ? {
          col: assessmentFieldColumn(alias, fieldId.slice(ASSESSMENT_FIELD_PREFIX.length), state),
          kind: 'scalar' as const
        }
      : resolveColumn(alias, fieldId, state, fieldKind, currencyAmount);
    if (!resolved) {
      throw new UnsupportedEntityQueryIRError(`Field '${fieldId}' has no SQL translation`);
    }
    // The visibility expression is rendered before the predicate in the CASE wrapper, so its
    // parameters must be allocated first as well.
    const scopeClause = schemaScopeClause(alias, fieldId, state);
    const clause =
      buildConformanceStatusConditionClause(fieldId, resolved.col, op, value, parameter =>
        addParam(state, parameter)
      ) ??
      buildConditionClause(
        resolved.col,
        { fieldId, op, value },
        parameter => addParam(state, parameter),
        state.dialect,
        resolved.kind
      );
    if (!clause) {
      throw new UnsupportedEntityQueryIRError(
        `Operator '${op}' has no SQL translation for field '${fieldId}'`
      );
    }
    return applyFieldVisibilityAsUnknown(clause, scopeClause);
  };

const compileFreeTextTerminal = (
  alias: string,
  value: string,
  state: EntityQuerySqlRenderState
): string => {
  const scalarFieldIds = [
    ...new Set(
      [...state.schemas.values()].flatMap(schema =>
        schema.fields
          .filter(field =>
            ['text', 'longtext', 'boolean', 'date', 'currency', 'number', 'select'].includes(
              field.type
            )
          )
          .map(field => field.id)
      )
    )
  ];
  return `(${['_name', '_slug', '_description', ...scalarFieldIds]
    .map(fieldId => compilePredicateTerminal(fieldId, 'contains', value, state)(alias))
    .join(' OR ')})`;
};

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

const RELATION_PSEUDO_FIELD_IDS = new Set(Object.keys(RELATION_BUILTIN_COLUMNS));

export const resolveRelationColumn = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): { col: string; kind: 'scalar' } | null => {
  if (Object.hasOwn(RELATION_BUILTIN_COLUMNS, fieldId)) {
    return { col: `${alias}.${RELATION_BUILTIN_COLUMNS[fieldId]}`, kind: 'scalar' };
  }
  if (!isValidFieldId(fieldId)) return null;
  return {
    col: state.dialectAdapter.jsonFieldText(`${alias}.data`, fieldId),
    kind: 'scalar'
  };
};

export const relationProjectionColumn = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): string => {
  if (Object.hasOwn(RELATION_BUILTIN_COLUMNS, fieldId)) {
    return state.dialectAdapter.toJson(`${alias}.${RELATION_BUILTIN_COLUMNS[fieldId]}`);
  }
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonFieldValue(`${alias}.data`, fieldId);
};

export const relationProjectionDataColumn = (
  dataExpression: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): string => {
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonFieldValue(dataExpression, fieldId);
};

const compileRelationRootPredicateTerminal =
  (fieldId: string, op: FilterCondition['op'], value: unknown, state: EntityQuerySqlRenderState) =>
  (alias: string): string => {
    const resolved = resolveRelationColumn(alias, fieldId, state);
    if (!resolved) {
      throw new UnsupportedEntityQueryIRError(`Field '${fieldId}' has no SQL translation`);
    }
    // The visibility expression is rendered before the predicate in the CASE wrapper, so its
    // parameters must be allocated first as well.
    const scopeClause = relationSchemaScopeClause(alias, fieldId, state);
    const clause = buildConditionClause(
      resolved.col,
      { fieldId, op, value },
      parameter => addParam(state, parameter),
      state.dialect,
      resolved.kind
    );
    if (!clause) {
      throw new UnsupportedEntityQueryIRError(
        `Operator '${op}' has no SQL translation for field '${fieldId}'`
      );
    }
    return applyFieldVisibilityAsUnknown(clause, scopeClause);
  };

export const compileRelationNode = (
  node: QueryNode,
  alias: string,
  relationSchemaId: string,
  state: EntityQuerySqlRenderState
): string => {
  switch (node.kind) {
    case 'and':
      return node.children.length === 0
        ? '1=1'
        : `(${node.children
            .map(child => compileRelationNode(child, alias, relationSchemaId, state))
            .join(' AND ')})`;
    case 'or':
      return node.children.length === 0
        ? '1=0'
        : `(${node.children
            .map(child => compileRelationNode(child, alias, relationSchemaId, state))
            .join(' OR ')})`;
    case 'not':
      return `NOT (${compileRelationNode(node.child, alias, relationSchemaId, state)})`;
    case 'predicate': {
      if (node.path.length > 0) {
        const first = node.path[0]!;
        if (first.kind !== 'endpoint' && first.kind !== 'relationForward') {
          throw new UnsupportedEntityQueryIRError(
            'Relation-instance filters may only contain scalar field predicates, or traverse an entityRelation field'
          );
        }
        return compilePathSteps(
          node.path,
          0,
          alias,
          state,
          compilePredicateTerminal(node.fieldId, node.op, node.value, state)
        );
      }
      const resolved = resolveRelationColumn(alias, node.fieldId, state);
      if (!RELATION_PSEUDO_FIELD_IDS.has(node.fieldId)) {
        const relationSchema = state.relationSchemas.get(relationSchemaId);
        const field = relationFieldById(relationSchema, node.fieldId);
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
      // Keep parameter allocation aligned with the CASE WHEN visibility expression below.
      const scopeClause = relationSchemaScopeClause(alias, node.fieldId, state);
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
      return applyFieldVisibilityAsUnknown(clause, scopeClause);
    }
    case 'relationExists': {
      if (node.path.length === 0) {
        throw new UnsupportedEntityQueryIRError("'relationExists' requires a non-empty path");
      }
      const first = node.path[0]!;
      if (first.kind !== 'endpoint' && first.kind !== 'relationForward') {
        throw new UnsupportedEntityQueryIRError(
          'Relation-instance filters may only contain scalar field predicates, or traverse an entityRelation field'
        );
      }
      return compilePathSteps(node.path, 0, alias, state, () => '1=1');
    }
    case 'freeText':
      throw new UnsupportedEntityQueryIRError(
        'Relation-instance filters may only contain scalar field predicates'
      );
  }
};

// Walks a PathStep[] emitting one correlated EXISTS subquery per hop. Step filters are compiled in
// the same subquery as the joined row, preserving same-witness semantics for `[ ... ]` filters.
export const compilePathSteps = (
  steps: PathStep[],
  index: number,
  curAlias: string,
  state: EntityQuerySqlRenderState,
  terminal: (alias: string) => string
): string => {
  if (index >= steps.length) return terminal(curAlias);

  const step = steps[index]!;
  if (step.kind === 'endpoint') {
    const alias = nextAlias(state);
    const targetId =
      step.direction === 'in' ? `${curAlias}.in_record_id` : `${curAlias}.out_record_id`;
    const rest = compilePathSteps(steps, index + 1, alias, state, terminal);
    return `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${alias}.id = ${targetId} AND ${rest})`;
  }
  if (step.kind === 'relationForward') {
    const alias = nextAlias(state);
    const joinClause = relationJoinClause(curAlias, step.fieldId, alias, state);
    const fieldScope = (() => {
      const scope = relationSchemaScopeClause(curAlias, step.fieldId, state);
      return scope ? ` AND ${scope}` : '';
    })();
    const filterClause = step.filter ? ` AND ${compileNode(step.filter, alias, state, false)}` : '';
    const rest = compilePathSteps(steps, index + 1, alias, state, terminal);
    return `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${joinClause}${fieldScope}${filterClause} AND ${rest})`;
  }
  if (step.kind === 'relationBackward') {
    const relationAlias = nextRelationAlias(state);
    const joinClause = relationJoinClause(relationAlias, step.fieldId, curAlias, state);
    const relationSchemaParam = addParam(state, step.relationSchemaId);
    const filterClause = step.filter
      ? ` AND ${compileRelationNode(step.filter, relationAlias, step.relationSchemaId, state)}`
      : '';
    const rest = compilePathSteps(steps, index + 1, relationAlias, state, terminal);
    return (
      `EXISTS (SELECT 1 FROM ${RELATION_SCOPE_CTE} ${relationAlias} ` +
      `WHERE ${relationAlias}.schema_id = ${relationSchemaParam} AND ${joinClause}${filterClause} AND ${rest})`
    );
  }
  if (step.kind === 'typedRelation' || step.kind === 'unboundTypedRelation') {
    const relationAlias = nextRelationAlias(state);
    const targetAlias = nextAlias(state);
    const ownerId =
      step.direction === 'in' ? `${relationAlias}.in_record_id` : `${relationAlias}.out_record_id`;
    const targetId =
      step.direction === 'in' ? `${relationAlias}.out_record_id` : `${relationAlias}.in_record_id`;
    const relationSchemaParam = addParam(state, step.relationSchemaId);
    const ownerSchemaClause =
      step.kind === 'typedRelation'
        ? typedRelationOwnerSchemaClause(curAlias, step.ownerSchemaIds, state)
        : unboundTypedRelationOwnerSchemaClause(
            curAlias,
            step.relationSchemaId,
            step.direction,
            state
          );
    const filterClause = step.filter
      ? ` AND ${compileRelationNode(step.filter, relationAlias, step.relationSchemaId, state)}`
      : '';
    const rest = compilePathSteps(steps, index + 1, targetAlias, state, terminal);
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
      ? relationJoinClause(curAlias, step.fieldId, alias, state)
      : relationJoinClause(alias, step.fieldId, curAlias, state);
  // addParam mutates the shared allocator, so evaluate this before later interpolated fragments in
  // the same SQL expression to keep placeholders and parameter values aligned.
  const ownerSchemaClause =
    step.kind === 'backward'
      ? ` AND ${alias}.schema_id = ${addParam(state, step.ownerSchemaId)}`
      : '';
  const forwardScopeClause =
    step.kind === 'forward'
      ? (() => {
          const scope = schemaScopeClause(curAlias, step.fieldId, state);
          return scope ? ` AND ${scope}` : '';
        })()
      : '';
  const filterClause = step.filter ? ` AND ${compileNode(step.filter, alias, state, false)}` : '';
  const rest = compilePathSteps(steps, index + 1, alias, state, terminal);

  return (
    `EXISTS (SELECT 1 FROM ${SCOPE_CTE} ${alias} WHERE ${joinClause}${ownerSchemaClause}` +
    `${forwardScopeClause}${filterClause} AND ${rest})`
  );
};

const compileBoundNode = (
  node: Extract<QueryNode, { kind: 'predicate' | 'relationExists' }>,
  alias: string,
  binding: { name: string; path: PathStep[] },
  state: EntityQuerySqlRenderState
): string => {
  const bindingAlias = `pb_${binding.name}`;
  const rootClause = `${bindingAlias}.root_id = ${alias}.id`;
  if (node.kind === 'relationExists') {
    return `EXISTS (SELECT 1 FROM ${binding.name} ${bindingAlias} WHERE ${rootClause})`;
  }

  const targetAlias = `pt_${binding.name}`;
  const landingKind = kindAfterPath(binding.path, state.rootKind);
  if (landingKind === 'relation') {
    const targetId = `${bindingAlias}.relation_${node.path.length}_id`;
    const terminal = compileRelationRootPredicateTerminal(
      node.fieldId,
      node.op,
      node.value,
      state
    )(targetAlias);
    return (
      `EXISTS (SELECT 1 FROM ${binding.name} ${bindingAlias} ` +
      `JOIN ${RELATION_SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} ` +
      `WHERE ${rootClause} AND ${terminal})`
    );
  }

  const targetId = `${bindingAlias}.hop_${node.path.length}_id`;
  const terminal = compilePredicateTerminal(node.fieldId, node.op, node.value, state)(targetAlias);
  return (
    `EXISTS (SELECT 1 FROM ${binding.name} ${bindingAlias} ` +
    `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} ` +
    `WHERE ${rootClause} AND ${terminal})`
  );
};

export const compileNode = (
  node: QueryNode,
  alias: string,
  state: EntityQuerySqlRenderState,
  allowFreeText: boolean
): string => {
  switch (node.kind) {
    case 'and':
      return node.children.length === 0
        ? '1=1'
        : `(${node.children
            .map(child => compileNode(child, alias, state, allowFreeText))
            .join(' AND ')})`;
    case 'or':
      return node.children.length === 0
        ? '1=0'
        : `(${node.children
            .map(child => compileNode(child, alias, state, allowFreeText))
            .join(' OR ')})`;
    case 'not':
      return `NOT (${compileNode(node.child, alias, state, allowFreeText)})`;
    case 'freeText':
      if (!allowFreeText) {
        throw new UnsupportedEntityQueryIRError(
          "'freeText' is only valid for the starting entity list"
        );
      }
      return compileFreeTextTerminal(alias, node.value, state);
    case 'predicate':
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(entityQueryPathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, state);
      }
      if (alias === ROOT_ALIAS && state.rootKind === 'relation' && node.path.length === 0) {
        return compileRelationRootPredicateTerminal(
          node.fieldId,
          node.op,
          node.value,
          state
        )(alias);
      }
      {
        const pathStartKind: 'entity' | 'relation' =
          alias === ROOT_ALIAS ? state.rootKind : 'entity';
        const landingKind = kindAfterPath(node.path, pathStartKind);
        return compilePathSteps(
          node.path,
          0,
          alias,
          state,
          landingKind === 'relation'
            ? compileRelationRootPredicateTerminal(node.fieldId, node.op, node.value, state)
            : compilePredicateTerminal(node.fieldId, node.op, node.value, state)
        );
      }
    case 'relationExists':
      if (alias === ROOT_ALIAS && !state.compilingBinding) {
        const binding = state.bindingByPath.get(entityQueryPathKey(node.path));
        if (binding) return compileBoundNode(node, alias, binding, state);
      }
      return compilePathSteps(node.path, 0, alias, state, () => '1=1');
  }
};
