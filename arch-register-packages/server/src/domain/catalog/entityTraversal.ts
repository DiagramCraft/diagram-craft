import {
  type EntityQuery,
  type PathStep,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  ENTITY_PSEUDO_FIELD_IDS,
  RELATION_PSEUDO_FIELD_IDS,
  kindAfterPath,
  relationFieldById,
  resolveEntityQueryRootKind,
  schemaFieldById,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRResolution';
import {
  validateEntityQueryIR,
  validatePathSteps,
  type ValidationError
} from './entityQueryIRValidator';
import { buildQueryFragments } from './entityQueryIRSqlAssembly';
import type { EntityQuerySqlRenderState } from './entityQueryIRSqlContext';
import {
  compileNode,
  compileRelationNode,
  jsonArrayLateralElement,
  relationJoinClause,
  relationSchemaScopeClause,
  schemaScopeClause,
  typedRelationOwnerSchemaClause,
  unboundTypedRelationOwnerSchemaClause,
  assertValidFieldId
} from './entityQueryIRSqlPredicates';
import type { DatabaseAdapter } from '../../db/database';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { buildEntityViewPermissionScope } from './db/entityPermissionScope';
import { buildTypedRelationVisibilityPolicy } from './relationAccessControl';
import type { EntityQueryDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';

export const DEFAULT_ENTITY_TRAVERSAL_MAX_DEPTH = 20;
export const DEFAULT_ENTITY_TRAVERSAL_MAX_NODES = 5_000;

export type EntityTraversalPathTerminal = 'entity' | 'relation';

export type EntityTraversalRoot =
  | { kind: 'ids'; entityIds: readonly string[] }
  | { kind: 'entityQuery'; entityQuery: EntityQuery };

export type EntityTraversalSourceField = {
  context: EntityTraversalPathTerminal;
  fieldId: string;
  /** Result key; defaults to fieldId. */
  alias?: string;
};

/**
 * Internal server traversal input. Roots are selected once, then every path is evaluated against
 * the selected root rows; a root query is never reapplied to descendant terminals.
 */
export type EntityTraversalPath = {
  id: string;
  steps: readonly PathStep[];
  sourceFields?: readonly EntityTraversalSourceField[];
};

/** A batched traversal request shared by map and metric consumers. */
export type EntityTraversalPlan = {
  root: EntityTraversalRoot;
  paths: readonly EntityTraversalPath[];
  maxDepth?: number;
  maxNodes?: number;
};

export type EntityTraversalHop = {
  context: EntityTraversalPathTerminal;
  id: string;
  schemaId: string;
};

/** A terminal row plus the requested values from its entity or relation context. */
export type EntityTraversalTerminal = {
  context: EntityTraversalPathTerminal;
  id: string;
  schemaId: string;
  source: Record<string, unknown>;
};

export type EntityTraversalOccurrence = {
  rootId: string;
  pathId: string;
  terminal: EntityTraversalTerminal;
  provenance: readonly EntityTraversalHop[];
};

/** Per-root/path output; occurrences retain provenance while distinctTerminals supports counting. */
export type EntityTraversalPathResult = {
  pathId: string;
  occurrences: readonly EntityTraversalOccurrence[];
  distinctTerminals: readonly EntityTraversalTerminal[];
  duplicateCount: number;
  cycleDetected: boolean;
};

export type EntityTraversalRootResult = {
  rootId: string;
  paths: readonly EntityTraversalPathResult[];
};

export type EntityTraversalResult = {
  roots: readonly EntityTraversalRootResult[];
};

export class EntityTraversalValidationError extends Error {
  readonly errors: readonly ValidationError[];

  constructor(errors: readonly ValidationError[]) {
    super(errors.map(error => `${error.path.join('.')}: ${error.message}`).join('; '));
    this.name = 'EntityTraversalValidationError';
    this.errors = errors;
  }
}

export class EntityTraversalLimitError extends Error {
  readonly rootId: string;
  readonly pathId: string;
  readonly maxDepth: number;
  readonly maxNodes: number;

  constructor(rootId: string, pathId: string, maxDepth: number, maxNodes: number) {
    super(
      `Entity traversal '${pathId}' exceeded its limit for root '${rootId}' ` +
        `(maxDepth=${maxDepth}, maxNodes=${maxNodes})`
    );
    this.name = 'EntityTraversalLimitError';
    this.rootId = rootId;
    this.pathId = pathId;
    this.maxDepth = maxDepth;
    this.maxNodes = maxNodes;
  }
}

type TraversalRow = EntityQueryDbResult;

const emptyRootQuery = (): EntityQuery => ({
  root_kind: 'entity',
  root: { kind: 'and', children: [] }
});

const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)];

const pathUsesRecursiveContainment = (steps: readonly PathStep[]): boolean =>
  steps.some(
    step =>
      step.kind === 'containmentSubtree' ||
      ('filter' in step && step.filter != null && queryNodeUsesRecursiveContainment(step.filter))
  );

const queryNodeUsesRecursiveContainment = (node: QueryNode): boolean => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.some(queryNodeUsesRecursiveContainment);
    case 'not':
      return queryNodeUsesRecursiveContainment(node.child);
    case 'predicate':
      return pathUsesRecursiveContainment(node.path);
    case 'relationExists':
      return pathUsesRecursiveContainment(node.path);
    case 'freeText':
      return false;
  }
};

const entityFieldIsVisible = (
  fieldId: string,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (ENTITY_PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith('_assessment:')) return true;
  return [...schemas.values()].some(
    schema =>
      schemaFieldById(schema, fieldId) != null && !isFieldViewRestricted(authCtx, schema, fieldId)
  );
};

const relationFieldIsVisible = (
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (RELATION_PSEUDO_FIELD_IDS.has(fieldId)) return true;
  return [...relationSchemas.values()].some(
    schema =>
      relationFieldById(schema, fieldId) != null && !isFieldViewRestricted(authCtx, schema, fieldId)
  );
};

export const validateEntityTraversalPlan = (
  plan: EntityTraversalPlan,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null = null
): void => {
  const errors: ValidationError[] = [];
  if (plan.paths.length === 0) {
    errors.push({ path: ['paths'], message: 'At least one traversal path is required' });
  }
  const maxDepth = plan.maxDepth ?? DEFAULT_ENTITY_TRAVERSAL_MAX_DEPTH;
  const maxNodes = plan.maxNodes ?? DEFAULT_ENTITY_TRAVERSAL_MAX_NODES;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 1_000) {
    errors.push({ path: ['maxDepth'], message: 'maxDepth must be an integer between 0 and 1000' });
  }
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 100_000) {
    errors.push({
      path: ['maxNodes'],
      message: 'maxNodes must be an integer between 1 and 100000'
    });
  }

  if (plan.root.kind === 'entityQuery') {
    const rootValidation = validateEntityQueryIR(
      plan.root.entityQuery,
      schemas,
      authCtx,
      relationSchemas
    );
    if (!rootValidation.ok) errors.push(...rootValidation.errors);
    if (
      resolveEntityQueryRootKind(plan.root.entityQuery, schemas, relationSchemas).rootKind !==
      'entity'
    ) {
      errors.push({
        path: ['root', 'entityQuery', 'root_kind'],
        message: 'Entity traversal roots must be entity-rooted'
      });
    }
    if ((plan.root.entityQuery.projections ?? []).length > 0) {
      errors.push({
        path: ['root', 'entityQuery', 'projections'],
        message: 'Entity traversal root queries cannot request projections'
      });
    }
    if (queryNodeUsesRecursiveContainment(plan.root.entityQuery.root)) {
      errors.push({
        path: ['root', 'entityQuery', 'root'],
        message:
          "Entity traversal root queries cannot use 'containmentSubtree'; put recursive steps in a traversal path"
      });
    }
  } else {
    plan.root.entityIds.forEach((entityId, index) => {
      if (entityId.trim() === '') {
        errors.push({
          path: ['root', 'entityIds', index],
          message: 'Root entity ids must not be empty'
        });
      }
    });
  }

  const pathIds = new Set<string>();
  plan.paths.forEach((path, pathIndex) => {
    if (path.id.trim() === '') {
      errors.push({
        path: ['paths', pathIndex, 'id'],
        message: 'Traversal path id must not be empty'
      });
    }
    if (pathIds.has(path.id)) {
      errors.push({
        path: ['paths', pathIndex, 'id'],
        message: `Duplicate traversal path id '${path.id}'`
      });
    }
    pathIds.add(path.id);

    validatePathSteps(
      [...path.steps],
      schemas,
      relationSchemas,
      ['paths', pathIndex, 'steps'],
      0,
      errors,
      authCtx,
      'entity'
    );
    const terminal = kindAfterPath([...path.steps], 'entity') as EntityTraversalPathTerminal;
    const aliases = new Set<string>();
    (path.sourceFields ?? []).forEach((source, sourceIndex) => {
      if (source.context !== terminal) {
        errors.push({
          path: ['paths', pathIndex, 'sourceFields', sourceIndex, 'context'],
          message: `Source field context '${source.context}' does not match terminal context '${terminal}'`
        });
      }
      const visible =
        source.context === 'entity'
          ? entityFieldIsVisible(source.fieldId, schemas, authCtx)
          : relationFieldIsVisible(source.fieldId, relationSchemas, authCtx);
      if (!visible) {
        errors.push({
          path: ['paths', pathIndex, 'sourceFields', sourceIndex, 'fieldId'],
          message: `Unknown or restricted ${source.context} source field '${source.fieldId}'`
        });
      }
      if (source.alias != null && source.alias.trim() === '') {
        errors.push({
          path: ['paths', pathIndex, 'sourceFields', sourceIndex, 'alias'],
          message: 'Source field aliases must not be empty'
        });
      }
      const alias = source.alias ?? source.fieldId;
      if (aliases.has(alias)) {
        errors.push({
          path: ['paths', pathIndex, 'sourceFields', sourceIndex, 'alias'],
          message: `Duplicate source field alias '${alias}'`
        });
      }
      aliases.add(alias);
    });
  });

  if (errors.length > 0) throw new EntityTraversalValidationError(errors);
};

const textExpression = (expression: string, state: EntityQuerySqlRenderState): string =>
  state.dialectAdapter.textCast(expression);

const listStart = (expression: string, state: EntityQuerySqlRenderState): string =>
  `('|' || ${textExpression(expression, state)} || '|')`;

const listAppend = (
  listExpression: string,
  expression: string,
  state: EntityQuerySqlRenderState
): string => `(${listExpression} || ${textExpression(expression, state)} || '|')`;

const listAppendLiteral = (listExpression: string, value: string): string =>
  `(${listExpression} || '${value}' || '|')`;

const listContains = (
  listExpression: string,
  expression: string,
  state: EntityQuerySqlRenderState
): string => {
  const token = `'|' || ${textExpression(expression, state)} || '|'`;
  return state.dialect === 'postgres'
    ? `POSITION(${token} IN ${listExpression}) > 0`
    : `instr(${listExpression}, ${token}) > 0`;
};

const referenceContainsId = (
  ownerAlias: string,
  fieldId: string,
  targetIdExpression: string,
  state: EntityQuerySqlRenderState
): string => {
  assertValidFieldId(fieldId);
  const targetText = textExpression(targetIdExpression, state);
  if (state.dialect === 'postgres') {
    return `(CASE jsonb_typeof(${ownerAlias}.data->'${fieldId}')
      WHEN 'array' THEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(${ownerAlias}.data->'${fieldId}') AS ref(value) WHERE ref.value = ${targetText})
      WHEN 'string' THEN (${ownerAlias}.data->>'${fieldId}') = ${targetText}
      ELSE FALSE
    END)`;
  }
  return `(CASE json_type(${ownerAlias}.data, '$.${fieldId}')
    WHEN 'array' THEN EXISTS (SELECT 1 FROM json_each(${ownerAlias}.data, '$.${fieldId}') AS ref WHERE ref.value = ${targetText})
    WHEN 'text' THEN json_extract(${ownerAlias}.data, '$.${fieldId}') = ${targetText}
    ELSE 0
  END)`;
};

type SourceValue = { expression: string; isJson: boolean };

const entitySourceValue = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): SourceValue => {
  switch (fieldId) {
    case '_id':
      return { expression: `${alias}.id`, isJson: false };
    case '_schemaId':
      return { expression: `${alias}.schema_id`, isJson: false };
    case '_name':
      return { expression: `${alias}.name`, isJson: false };
    case '_description':
      return { expression: `${alias}.description`, isJson: false };
    case '_slug':
      return { expression: `${alias}.slug`, isJson: false };
    case '_namespace':
      return { expression: `${alias}.namespace`, isJson: false };
    case '_owner':
      return { expression: `${alias}.owner`, isJson: false };
    case '_lifecycle':
      return { expression: `${alias}.lifecycle`, isJson: false };
    case '_updatedAt':
      return { expression: `${alias}.updated_at`, isJson: false };
    case '_completeness':
      return { expression: `${alias}.completeness`, isJson: false };
    case '_tags':
      return { expression: `${alias}.tags`, isJson: true };
    case '_links':
      return { expression: `${alias}.links`, isJson: true };
    case '_assessment':
      return { expression: `${alias}.assessment_values`, isJson: true };
    default:
      if (fieldId.startsWith('_assessment:')) {
        return {
          expression: state.dialectAdapter.jsonFieldValue(
            `${alias}.assessment_values`,
            fieldId.slice('_assessment:'.length)
          ),
          isJson: false
        };
      }
      return {
        expression: state.dialectAdapter.jsonFieldValue(`${alias}.data`, fieldId),
        isJson: [...state.schemas.values()].some(schema => {
          const field = schemaFieldById(schema, fieldId);
          return (
            field != null &&
            (field.type === 'reference' ||
              field.type === 'containment' ||
              field.type === 'typedRelation' ||
              ('maxCount' in field && field.maxCount !== 1) ||
              ('maxCardinality' in field &&
                field.maxCardinality != null &&
                field.maxCardinality !== 1))
          );
        })
      };
  }
};

const relationSourceValue = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): SourceValue => {
  switch (fieldId) {
    case '_id':
      return { expression: `${alias}.id`, isJson: false };
    case '_schemaId':
      return { expression: `${alias}.schema_id`, isJson: false };
    case '_inEntityId':
      return { expression: `${alias}.in_record_id`, isJson: false };
    case '_outEntityId':
      return { expression: `${alias}.out_record_id`, isJson: false };
    case '_createdAt':
      return { expression: `${alias}.created_at`, isJson: false };
    case '_updatedAt':
      return { expression: `${alias}.updated_at`, isJson: false };
    default:
      return {
        expression: state.dialectAdapter.jsonFieldValue(`${alias}.data`, fieldId),
        isJson: [...state.relationSchemas.values()].some(schema => {
          const field = relationFieldById(schema, fieldId);
          return (
            field != null &&
            ((field.type === 'entityRelation' && field.maxCount !== 1) ||
              ('maxCardinality' in field &&
                field.maxCardinality != null &&
                field.maxCardinality !== 1))
          );
        })
      };
  }
};

const visibleSourceValue = (
  source: EntityTraversalSourceField,
  value: SourceValue,
  entityAlias: string,
  relationAlias: string,
  state: EntityQuerySqlRenderState
): SourceValue => {
  if (
    state.authCtx == null ||
    (source.context === 'entity'
      ? ENTITY_PSEUDO_FIELD_IDS.has(source.fieldId) || source.fieldId.startsWith('_assessment:')
      : RELATION_PSEUDO_FIELD_IDS.has(source.fieldId))
  ) {
    return value;
  }
  const alias = source.context === 'entity' ? entityAlias : relationAlias;
  const schemaIds =
    source.context === 'entity'
      ? [...state.schemas.values()]
          .filter(schema => schemaFieldById(schema, source.fieldId) != null)
          .filter(schema => !isFieldViewRestricted(state.authCtx, schema, source.fieldId))
          .map(schema => schema.id)
      : [...state.relationSchemas.values()]
          .filter(schema => relationFieldById(schema, source.fieldId) != null)
          .filter(schema => !isFieldViewRestricted(state.authCtx, schema, source.fieldId))
          .map(schema => schema.id);
  if (schemaIds.length === 0) return { expression: 'NULL', isJson: value.isJson };
  const scope = `${alias}.schema_id IN (${schemaIds
    .map(schemaId => state.parameters.add(schemaId))
    .join(', ')})`;
  return {
    expression: `(CASE WHEN ${scope} THEN ${value.expression} ELSE NULL END)`,
    isJson: value.isJson
  };
};

const sourceObject = (
  sources: readonly EntityTraversalSourceField[],
  state: EntityQuerySqlRenderState,
  entityAlias: string,
  relationAlias: string
): string => {
  if (sources.length === 0) return state.dialectAdapter.emptyObject;
  const entries = sources.flatMap(source => {
    const key = state.dialectAdapter.textCast(state.parameters.add(source.alias ?? source.fieldId));
    const raw =
      source.context === 'entity'
        ? entitySourceValue(entityAlias, source.fieldId, state)
        : relationSourceValue(relationAlias, source.fieldId, state);
    const value = visibleSourceValue(source, raw, entityAlias, relationAlias, state);
    return [key, value.isJson ? state.dialectAdapter.wrapJson(value.expression) : value.expression];
  });
  return state.dialectAdapter.jsonObject(entries);
};

const appendHop = (
  previousAlias: string,
  targetContext: EntityTraversalPathTerminal,
  targetId: string,
  targetSchemaId: string,
  targetName: string,
  state: EntityQuerySqlRenderState
): string =>
  [
    `${previousAlias}.root_id AS root_id`,
    `'${targetContext}' AS current_kind`,
    `${targetId} AS current_id`,
    `${targetSchemaId} AS current_schema_id`,
    `${targetName} AS current_name`,
    `${previousAlias}.recursive_depth AS recursive_depth`,
    `${listAppend(`${previousAlias}.visited_ids`, targetId, state)} AS visited_ids`,
    `${listAppendLiteral(`${previousAlias}.provenance_contexts`, targetContext)} AS provenance_contexts`,
    `${listAppend(`${previousAlias}.provenance_ids`, targetId, state)} AS provenance_ids`,
    `${listAppend(`${previousAlias}.provenance_schema_ids`, targetSchemaId, state)} AS provenance_schema_ids`,
    `${previousAlias}.cycle_detected AS cycle_detected`
  ].join(',\n      ');

const rootStream = (alias: string, state: EntityQuerySqlRenderState): string =>
  [
    `${alias}.id AS root_id`,
    `'entity' AS current_kind`,
    `${alias}.id AS current_id`,
    `${alias}.schema_id AS current_schema_id`,
    `${alias}.name AS current_name`,
    '0 AS recursive_depth',
    `${listStart(`${alias}.id`, state)} AS visited_ids`,
    `'|entity|' AS provenance_contexts`,
    `${listStart(`${alias}.id`, state)} AS provenance_ids`,
    `${listStart(`${alias}.schema_id`, state)} AS provenance_schema_ids`,
    '0 AS cycle_detected'
  ].join(',\n      ');

const fixedStepCte = (
  cteName: string,
  previousName: string,
  previousKind: EntityTraversalPathTerminal,
  step: Exclude<PathStep, { kind: 'containmentSubtree' }>,
  state: EntityQuerySqlRenderState
): { sql: string; nextKind: EntityTraversalPathTerminal } => {
  const previousAlias = `p_${cteName}`.replace(/[^a-zA-Z0-9_]/g, '_');
  let from = `FROM ${previousName} ${previousAlias}`;
  let projection: string;
  let nextKind: EntityTraversalPathTerminal;

  if (step.kind === 'forward') {
    if (previousKind !== 'entity') throw new Error("'forward' traversal step requires an entity");
    const owner = `${previousAlias}_owner`;
    const target = `${previousAlias}_target`;
    from += ` JOIN scoped_entity ${owner} ON ${owner}.id = ${previousAlias}.current_id`;
    from += ` JOIN scoped_entity ${target} ON ${relationJoinClause(owner, step.fieldId, target, state)}`;
    const scope = schemaScopeClause(owner, step.fieldId, state);
    if (scope) from += ` AND ${scope}`;
    if (step.filter) from += ` AND ${compileNode(step.filter, target, state, false)}`;
    projection = appendHop(
      previousAlias,
      'entity',
      `${target}.id`,
      `${target}.schema_id`,
      `${target}.name`,
      state
    );
    nextKind = 'entity';
  } else if (step.kind === 'backward') {
    if (previousKind !== 'entity') throw new Error("'backward' traversal step requires an entity");
    const target = `${previousAlias}_target`;
    from += ` JOIN scoped_entity ${target} ON ${referenceContainsId(target, step.fieldId, `${previousAlias}.current_id`, state)}`;
    from += ` AND ${target}.schema_id = ${state.parameters.add(step.ownerSchemaId)}`;
    const scope = schemaScopeClause(target, step.fieldId, state);
    if (scope) from += ` AND ${scope}`;
    if (step.filter) from += ` AND ${compileNode(step.filter, target, state, false)}`;
    projection = appendHop(
      previousAlias,
      'entity',
      `${target}.id`,
      `${target}.schema_id`,
      `${target}.name`,
      state
    );
    nextKind = 'entity';
  } else if (step.kind === 'typedRelation' || step.kind === 'unboundTypedRelation') {
    if (previousKind !== 'entity')
      throw new Error("'typedRelation' traversal step requires an entity");
    const owner = `${previousAlias}_owner`;
    const relation = `${previousAlias}_relation`;
    const target = `${previousAlias}_target`;
    const relationSchema = state.parameters.add(step.relationSchemaId);
    const ownerId =
      step.direction === 'in' ? `${relation}.in_record_id` : `${relation}.out_record_id`;
    const targetId =
      step.direction === 'in' ? `${relation}.out_record_id` : `${relation}.in_record_id`;
    const ownerSchema =
      step.kind === 'typedRelation'
        ? typedRelationOwnerSchemaClause(owner, step.ownerSchemaIds, state)
        : unboundTypedRelationOwnerSchemaClause(
            owner,
            step.relationSchemaId,
            step.direction,
            state
          );
    from += ` JOIN scoped_entity ${owner} ON ${owner}.id = ${previousAlias}.current_id`;
    from += ` JOIN scoped_relation ${relation} ON ${relation}.workspace = ${owner}.workspace AND ${relation}.schema_id = ${relationSchema} AND ${ownerSchema} AND ${ownerId} = ${owner}.id`;
    if (step.filter)
      from += ` AND ${compileRelationNode(step.filter, relation, step.relationSchemaId, state)}`;
    from += ` JOIN scoped_entity ${target} ON ${target}.id = ${targetId}`;
    projection = appendHop(
      previousAlias,
      'entity',
      `${target}.id`,
      `${target}.schema_id`,
      `${target}.name`,
      state
    );
    nextKind = 'entity';
  } else if (step.kind === 'endpoint') {
    if (previousKind !== 'relation')
      throw new Error("'endpoint' traversal step requires a relation");
    const relation = `${previousAlias}_relation`;
    const target = `${previousAlias}_target`;
    const targetId =
      step.direction === 'in' ? `${relation}.in_record_id` : `${relation}.out_record_id`;
    from += ` JOIN scoped_relation ${relation} ON ${relation}.id = ${previousAlias}.current_id`;
    from += ` JOIN scoped_entity ${target} ON ${target}.id = ${targetId}`;
    projection = appendHop(
      previousAlias,
      'entity',
      `${target}.id`,
      `${target}.schema_id`,
      `${target}.name`,
      state
    );
    nextKind = 'entity';
  } else if (step.kind === 'relationForward') {
    if (previousKind !== 'relation')
      throw new Error("'relationForward' traversal step requires a relation");
    const relation = `${previousAlias}_relation`;
    const target = `${previousAlias}_target`;
    const element = jsonArrayLateralElement(relation, step.fieldId, `${target}_element`, state);
    from += ` JOIN scoped_relation ${relation} ON ${relation}.id = ${previousAlias}.current_id ${element.joinClause}`;
    const scope = relationSchemaScopeClause(relation, step.fieldId, state);
    from += ` JOIN scoped_entity ${target} ON ${target}.id = ${element.valueColumn}${scope ? ` AND ${scope}` : ''}`;
    if (step.filter) from += ` AND ${compileNode(step.filter, target, state, false)}`;
    projection = appendHop(
      previousAlias,
      'entity',
      `${target}.id`,
      `${target}.schema_id`,
      `${target}.name`,
      state
    );
    nextKind = 'entity';
  } else if (step.kind === 'relationBackward') {
    if (previousKind !== 'entity')
      throw new Error("'relationBackward' traversal step requires an entity");
    const relation = `${previousAlias}_relation`;
    from += ` JOIN scoped_relation ${relation} ON ${relation}.schema_id = ${state.parameters.add(step.relationSchemaId)} AND ${referenceContainsId(relation, step.fieldId, `${previousAlias}.current_id`, state)}`;
    if (step.filter)
      from += ` AND ${compileRelationNode(step.filter, relation, step.relationSchemaId, state)}`;
    projection = appendHop(
      previousAlias,
      'relation',
      `${relation}.id`,
      `${relation}.schema_id`,
      'NULL',
      state
    );
    nextKind = 'relation';
  } else {
    throw new Error("'containmentSubtree' must be handled by the recursive traversal compiler");
  }

  return {
    sql: `${cteName} AS (SELECT ${projection} ${from})`,
    nextKind
  };
};

type RecursiveMarker = {
  name: string;
  depthExceeded: string;
  nodeExceeded: string;
  cycleDetected: string;
};

const recursiveStepCte = (
  cteName: string,
  previousName: string,
  step: Extract<PathStep, { kind: 'containmentSubtree' }>,
  state: EntityQuerySqlRenderState,
  maxDepth: number,
  maxNodes: number
): { sql: string; marker: RecursiveMarker } => {
  const previousAlias = `p_${cteName}`.replace(/[^a-zA-Z0-9_]/g, '_');
  const seedAlias = `${previousAlias}_seed`;
  const childAlias = `${previousAlias}_child`;
  // Allocate parameters in the same order in which the seed and recursive terms appear in SQL.
  // This is observable for SQLite, whose positional `?` placeholders cannot be reused.
  const seedOwnerSchemaParam = state.parameters.add(step.ownerSchemaId);
  const seedFilter = step.filter ? ` AND ${compileNode(step.filter, seedAlias, state, false)}` : '';
  const recursiveOwnerSchemaParam = state.parameters.add(step.ownerSchemaId);
  const maxDepthParam = state.parameters.add(maxDepth);
  const childJoin = referenceContainsId(
    childAlias,
    step.fieldId,
    `${previousAlias}.current_id`,
    state
  );
  const childFilter = step.filter
    ? ` AND ${compileNode(step.filter, childAlias, state, false)}`
    : '';
  const seedColumns = [
    `${previousAlias}.root_id AS root_id`,
    `'entity' AS current_kind`,
    `${seedAlias}.id AS current_id`,
    `${seedAlias}.schema_id AS current_schema_id`,
    `${seedAlias}.name AS current_name`,
    '0 AS recursive_depth',
    `${previousAlias}.visited_ids AS visited_ids`,
    `${previousAlias}.provenance_contexts AS provenance_contexts`,
    `${previousAlias}.provenance_ids AS provenance_ids`,
    `${previousAlias}.provenance_schema_ids AS provenance_schema_ids`,
    `${previousAlias}.cycle_detected AS cycle_detected`
  ];
  const seed = `SELECT ${seedColumns.join(', ')} FROM ${previousName} ${previousAlias} JOIN scoped_entity ${seedAlias} ON ${seedAlias}.id = ${previousAlias}.current_id AND ${seedAlias}.schema_id = ${seedOwnerSchemaParam}${seedFilter}`;
  const recursiveColumns = [
    `${previousAlias}.root_id AS root_id`,
    `'entity' AS current_kind`,
    `${childAlias}.id AS current_id`,
    `${childAlias}.schema_id AS current_schema_id`,
    `${childAlias}.name AS current_name`,
    `${previousAlias}.recursive_depth + 1 AS recursive_depth`,
    `${listAppend(`${previousAlias}.visited_ids`, `${childAlias}.id`, state)} AS visited_ids`,
    `${listAppendLiteral(`${previousAlias}.provenance_contexts`, 'entity')} AS provenance_contexts`,
    `${listAppend(`${previousAlias}.provenance_ids`, `${childAlias}.id`, state)} AS provenance_ids`,
    `${listAppend(`${previousAlias}.provenance_schema_ids`, `${childAlias}.schema_id`, state)} AS provenance_schema_ids`,
    `${previousAlias}.cycle_detected AS cycle_detected`
  ];
  const recursive = `SELECT ${recursiveColumns.join(', ')} FROM ${cteName} ${previousAlias} JOIN scoped_entity ${childAlias} ON ${childAlias}.schema_id = ${recursiveOwnerSchemaParam} AND ${childJoin} WHERE ${previousAlias}.recursive_depth < ${maxDepthParam} AND NOT ${listContains(`${previousAlias}.visited_ids`, `${childAlias}.id`, state)}${childFilter}`;
  const markerName = `${cteName}_limits`;
  const markerAlias = `m_${cteName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const markerChild = `${markerAlias}_child`;
  const markerChildJoin = referenceContainsId(
    markerChild,
    step.fieldId,
    `${markerAlias}.current_id`,
    state
  );
  const nodeParam = state.parameters.add(maxNodes);
  const markerMaxDepthParam = state.parameters.add(maxDepth);
  const markerOwnerSchemaParam = state.parameters.add(step.ownerSchemaId);
  const markerFilter = step.filter
    ? ` AND ${compileNode(step.filter, markerChild, state, false)}`
    : '';
  const cycleChild = `${markerAlias}_cycle_child`;
  const cycleChildJoin = referenceContainsId(
    cycleChild,
    step.fieldId,
    `${markerAlias}.current_id`,
    state
  );
  const cycleOwnerSchemaParam = state.parameters.add(step.ownerSchemaId);
  const cycleFilter = step.filter
    ? ` AND ${compileNode(step.filter, cycleChild, state, false)}`
    : '';
  const marker = [
    `${markerName} AS (SELECT ${markerAlias}.root_id AS root_id,`,
    `CASE WHEN COUNT(*) > ${nodeParam} THEN 1 ELSE 0 END AS node_exceeded,`,
    `CASE WHEN MAX(CASE WHEN ${markerAlias}.recursive_depth >= ${markerMaxDepthParam} AND EXISTS (SELECT 1 FROM scoped_entity ${markerChild} WHERE ${markerChild}.schema_id = ${markerOwnerSchemaParam} AND ${markerChildJoin} AND NOT ${listContains(`${markerAlias}.visited_ids`, `${markerChild}.id`, state)}${markerFilter}) THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END AS depth_exceeded,`,
    `CASE WHEN MAX(CASE WHEN EXISTS (SELECT 1 FROM scoped_entity ${cycleChild} WHERE ${cycleChild}.schema_id = ${cycleOwnerSchemaParam} AND ${cycleChildJoin} AND ${listContains(`${markerAlias}.visited_ids`, `${cycleChild}.id`, state)}${cycleFilter}) THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END AS cycle_detected`,
    `FROM ${cteName} ${markerAlias} GROUP BY ${markerAlias}.root_id)`
  ].join(' ');
  return {
    sql: `${cteName} AS (${seed} UNION ALL ${recursive}), ${marker}`,
    marker: {
      name: markerName,
      depthExceeded: 'depth_exceeded',
      nodeExceeded: 'node_exceeded',
      cycleDetected: 'cycle_detected'
    }
  };
};

const mappedColumns = (
  entityAlias: string,
  relationAlias: string,
  fallbackAlias: string | null,
  entitySchemaAlias: string,
  relationSchemaAlias: string,
  projections: string,
  state: EntityQuerySqlRenderState
): string => {
  const entity = (column: string): string => `${entityAlias}.${column}`;
  const relation = (column: string): string => `${relationAlias}.${column}`;
  const fallback = (column: string): string =>
    fallbackAlias ? `${fallbackAlias}.${column}` : 'NULL';
  const coalesce = (column: string): string =>
    `COALESCE(${entity(column)}, ${relation(column)}, ${fallback(column)})`;
  return [
    `${coalesce('id')} AS id`,
    `${coalesce('workspace')} AS workspace`,
    `COALESCE(${entity('public_id')}, '') AS public_id`,
    `COALESCE(${entity('slug')}, '') AS slug`,
    `COALESCE(${entity('namespace')}, '') AS namespace`,
    `COALESCE(${entity('name')}, ${relationSchemaAlias}.name, '') AS name`,
    `COALESCE(${entity('description')}, '') AS description`,
    `${coalesce('owner')} AS owner`,
    `${coalesce('lifecycle')} AS lifecycle`,
    `${entity('target_lifecycle')} AS target_lifecycle`,
    `${entity('target_lifecycle_date')} AS target_lifecycle_date`,
    `COALESCE(${entity('tags')}, ${state.dialectAdapter.emptyArray}) AS tags`,
    `COALESCE(${entity('links')}, ${state.dialectAdapter.emptyArray}) AS links`,
    `${coalesce('schema_id')} AS schema_id`,
    `COALESCE(${entity('data')}, ${relation('data')}, ${state.dialectAdapter.emptyObject}) AS data`,
    `${entity('project_id')} AS project_id`,
    `${coalesce('version')} AS version`,
    `COALESCE(${entity('completeness')}, 0) AS completeness`,
    `COALESCE(${entity('generated_metadata')}, ${state.dialectAdapter.emptyObject}) AS generated_metadata`,
    `${entity('last_attested_at')} AS last_attested_at`,
    `${coalesce('approval_policy_override')} AS approval_policy_override`,
    `${coalesce('created_at')} AS created_at`,
    `${coalesce('updated_at')} AS updated_at`,
    'NULL AS owner_name',
    'NULL AS lifecycle_label',
    'NULL AS target_lifecycle_label',
    `COALESCE(${entitySchemaAlias}.name, ${relationSchemaAlias}.name, '') AS schema_name`,
    'NULL AS conformance_status',
    'NULL AS conformance_evaluated_at',
    'NULL AS conformance_stale',
    `${projections} AS projections`
  ].join(',\n    ');
};

const traversalMetadata = (
  pathIdExpression: string,
  streamAlias: string,
  source: string,
  cycleExpression: string,
  limitExpression: string,
  state: EntityQuerySqlRenderState,
  hasTerminal: boolean
): string => {
  const traversal = state.dialectAdapter.jsonObject([
    "'pathId'",
    pathIdExpression,
    "'rootId'",
    `${streamAlias}.root_id`,
    "'hasTerminal'",
    hasTerminal ? state.dialectAdapter.trueLiteral : state.dialectAdapter.falseLiteral,
    "'terminalKind'",
    hasTerminal ? `${streamAlias}.current_kind` : 'NULL',
    "'terminalId'",
    hasTerminal ? `${streamAlias}.current_id` : 'NULL',
    "'terminalSchemaId'",
    hasTerminal ? `${streamAlias}.current_schema_id` : 'NULL',
    "'provenanceContexts'",
    hasTerminal ? `${streamAlias}.provenance_contexts` : "''",
    "'provenanceIds'",
    hasTerminal ? `${streamAlias}.provenance_ids` : "''",
    "'provenanceSchemaIds'",
    hasTerminal ? `${streamAlias}.provenance_schema_ids` : "''",
    "'cycleDetected'",
    cycleExpression,
    "'limitExceeded'",
    limitExpression
  ]);
  return state.dialectAdapter.jsonObject([
    "'__traversal'",
    state.dialectAdapter.wrapJson(traversal),
    "'sources'",
    state.dialectAdapter.wrapJson(source)
  ]);
};

const compileTraversalSql = (
  plan: EntityTraversalPlan,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  dialect: 'postgres' | 'sqlite',
  workspace: string,
  authCtx: WorkspaceAuthorizationContext | null,
  collectionEntityIds: readonly string[] | undefined
): { sql: string; params: unknown[] } => {
  const rootQuery = plan.root.kind === 'entityQuery' ? plan.root.entityQuery : emptyRootQuery();
  const fragments = buildQueryFragments(
    rootQuery,
    schemas,
    dialect,
    workspace,
    {
      permissionScope: rootQuery.asOf ? null : buildEntityViewPermissionScope(authCtx),
      collectionEntityIds,
      relationVisibility: buildTypedRelationVisibilityPolicy(
        authCtx,
        schemas.values(),
        relationSchemas.values()
      )
    },
    authCtx,
    relationSchemas,
    false
  );
  const state = fragments.state;
  const withClause = fragments.withClause.startsWith('WITH RECURSIVE')
    ? fragments.withClause
    : fragments.withClause.replace(/^WITH\b/, 'WITH RECURSIVE');
  const rootIdClause =
    plan.root.kind === 'ids'
      ? plan.root.entityIds.length === 0
        ? '1=0'
        : `e0.id IN (${uniqueStrings(plan.root.entityIds)
            .map(entityId => state.parameters.add(entityId))
            .join(', ')})`
      : null;
  const rootWhere = [...fragments.whereParts, ...(rootIdClause ? [rootIdClause] : [])].join(
    ' AND '
  );
  const ctes: string[] = [
    `traversal_roots AS (SELECT ${rootStream('e0', state)} FROM scoped_entity e0 WHERE ${rootWhere})`
  ];
  const finalQueries: string[] = [];
  const compiledPaths: Array<{
    path: EntityTraversalPath;
    pathIndex: number;
    previousName: string;
    previousKind: EntityTraversalPathTerminal;
    markers: RecursiveMarker[];
  }> = [];

  plan.paths.forEach((path, pathIndex) => {
    let previousName = 'traversal_roots';
    let previousKind: EntityTraversalPathTerminal = 'entity';
    const markers: RecursiveMarker[] = [];
    path.steps.forEach((step, stepIndex) => {
      const cteName = `traversal_path_${pathIndex}_step_${stepIndex}`;
      if (step.kind === 'containmentSubtree') {
        const recursive = recursiveStepCte(
          cteName,
          previousName,
          step,
          state,
          plan.maxDepth ?? DEFAULT_ENTITY_TRAVERSAL_MAX_DEPTH,
          plan.maxNodes ?? DEFAULT_ENTITY_TRAVERSAL_MAX_NODES
        );
        ctes.push(recursive.sql);
        markers.push(recursive.marker);
        previousKind = 'entity';
      } else {
        const fixed = fixedStepCte(cteName, previousName, previousKind, step, state);
        ctes.push(fixed.sql);
        previousKind = fixed.nextKind;
      }
      previousName = cteName;
    });
    compiledPaths.push({ path, pathIndex, previousName, previousKind, markers });
  });

  compiledPaths.forEach(({ path, pathIndex, previousName, markers }) => {
    const streamAlias = `t_${pathIndex}`;
    const entityAlias = `te_${pathIndex}`;
    const relationAlias = `tr_${pathIndex}`;
    const entitySchemaAlias = `tes_${pathIndex}`;
    const relationSchemaAlias = `trs_${pathIndex}`;
    const markerJoins = markers
      .map(
        (marker, markerIndex) =>
          `LEFT JOIN ${marker.name} lm_${pathIndex}_${markerIndex} ON lm_${pathIndex}_${markerIndex}.root_id = ${streamAlias}.root_id`
      )
      .join(' ');
    const markerColumns = markers.flatMap((_, markerIndex) => [
      `COALESCE(lm_${pathIndex}_${markerIndex}.depth_exceeded, 0)`,
      `COALESCE(lm_${pathIndex}_${markerIndex}.node_exceeded, 0)`
    ]);
    const cycleColumns = markers.map(
      (_, markerIndex) => `COALESCE(lm_${pathIndex}_${markerIndex}.cycle_detected, 0)`
    );
    const limitExpression =
      markerColumns.length === 0
        ? '0'
        : `CASE WHEN (${markerColumns.join(' + ')}) > 0 THEN 1 ELSE 0 END`;
    const cycleExpression =
      cycleColumns.length === 0
        ? '0'
        : `CASE WHEN (${cycleColumns.join(' + ')}) > 0 THEN 1 ELSE 0 END`;
    const pathIdExpression = state.dialectAdapter.textCast(state.parameters.add(path.id));
    const source = sourceObject(path.sourceFields ?? [], state, entityAlias, relationAlias);
    const metadata = traversalMetadata(
      pathIdExpression,
      streamAlias,
      source,
      cycleExpression,
      limitExpression,
      state,
      true
    );
    const terminalFrom = `FROM ${previousName} ${streamAlias} LEFT JOIN scoped_entity ${entityAlias} ON ${entityAlias}.id = ${streamAlias}.current_id AND ${streamAlias}.current_kind = 'entity' LEFT JOIN scoped_relation ${relationAlias} ON ${relationAlias}.id = ${streamAlias}.current_id AND ${streamAlias}.current_kind = 'relation' LEFT JOIN entity_schema ${entitySchemaAlias} ON ${entitySchemaAlias}.id = ${entityAlias}.schema_id LEFT JOIN relation_schema ${relationSchemaAlias} ON ${relationSchemaAlias}.id = ${relationAlias}.schema_id ${markerJoins}`;
    finalQueries.push(
      `SELECT ${mappedColumns(entityAlias, relationAlias, null, entitySchemaAlias, relationSchemaAlias, metadata, state)} ${terminalFrom}`
    );

    const emptyStreamAlias = `er_${pathIndex}`;
    const emptyEntityAlias = `ere_${pathIndex}`;
    const emptyRelationAlias = `err_${pathIndex}`;
    const emptyEntitySchemaAlias = `eres_${pathIndex}`;
    const emptyRelationSchemaAlias = `errs_${pathIndex}`;
    const emptyMarkerJoins = markers
      .map(
        (marker, markerIndex) =>
          `LEFT JOIN ${marker.name} elm_${pathIndex}_${markerIndex} ON elm_${pathIndex}_${markerIndex}.root_id = ${emptyStreamAlias}.root_id`
      )
      .join(' ');
    const emptyMarkerColumns = markers.flatMap((_, markerIndex) => [
      `COALESCE(elm_${pathIndex}_${markerIndex}.depth_exceeded, 0)`,
      `COALESCE(elm_${pathIndex}_${markerIndex}.node_exceeded, 0)`
    ]);
    const emptyCycleColumns = markers.map(
      (_, markerIndex) => `COALESCE(elm_${pathIndex}_${markerIndex}.cycle_detected, 0)`
    );
    const emptyLimitExpression =
      emptyMarkerColumns.length === 0
        ? '0'
        : `CASE WHEN (${emptyMarkerColumns.join(' + ')}) > 0 THEN 1 ELSE 0 END`;
    const emptyCycleExpression =
      emptyCycleColumns.length === 0
        ? '0'
        : `CASE WHEN (${emptyCycleColumns.join(' + ')}) > 0 THEN 1 ELSE 0 END`;
    const emptyPathIdExpression = state.dialectAdapter.textCast(state.parameters.add(path.id));
    const emptyMetadata = traversalMetadata(
      emptyPathIdExpression,
      emptyStreamAlias,
      state.dialectAdapter.emptyObject,
      emptyCycleExpression,
      emptyLimitExpression,
      state,
      false
    );
    finalQueries.push(
      `SELECT ${mappedColumns(emptyEntityAlias, emptyRelationAlias, emptyEntityAlias, emptyEntitySchemaAlias, emptyRelationSchemaAlias, emptyMetadata, state)} FROM traversal_roots ${emptyStreamAlias} JOIN scoped_entity ${emptyEntityAlias} ON ${emptyEntityAlias}.id = ${emptyStreamAlias}.root_id LEFT JOIN scoped_relation ${emptyRelationAlias} ON 1=0 LEFT JOIN entity_schema ${emptyEntitySchemaAlias} ON ${emptyEntitySchemaAlias}.id = ${emptyEntityAlias}.schema_id LEFT JOIN relation_schema ${emptyRelationSchemaAlias} ON 1=0 ${emptyMarkerJoins} WHERE NOT EXISTS (SELECT 1 FROM ${previousName} existing_${pathIndex} WHERE existing_${pathIndex}.root_id = ${emptyStreamAlias}.root_id)`
    );
  });

  const select =
    finalQueries.length > 0
      ? finalQueries.map((query, index) => (index === 0 ? query : `UNION ALL ${query}`)).join(' ')
      : `SELECT ${rootStream('e0', state)} FROM scoped_entity e0 WHERE 1=0`;
  return {
    sql: `${withClause}, ${ctes.join(', ')} ${select} ORDER BY id`,
    params: state.parameters.values
  };
};

const parseDelimited = (value: unknown): string[] =>
  String(value ?? '')
    .split('|')
    .filter(Boolean);

const asBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 'true';

const toTraversalResult = (
  rows: readonly TraversalRow[],
  plan: EntityTraversalPlan,
  maxDepth: number,
  maxNodes: number
): EntityTraversalResult => {
  const roots = new Map<
    string,
    Map<
      string,
      {
        occurrences: EntityTraversalOccurrence[];
        distinct: Map<string, EntityTraversalTerminal>;
        cycleDetected: boolean;
      }
    >
  >();
  const rootOrder: string[] = [];
  const pathIds = new Set(plan.paths.map(path => path.id));

  rows.forEach(row => {
    const projections = row.projections as Record<string, unknown>;
    const metadata = projections.__traversal as Record<string, unknown> | undefined;
    if (!metadata) return;
    const rootId = String(metadata.rootId ?? row.id);
    const pathId = String(metadata.pathId ?? '');
    if (!pathIds.has(pathId)) return;
    if (asBoolean(metadata.limitExceeded)) {
      throw new EntityTraversalLimitError(rootId, pathId, maxDepth, maxNodes);
    }
    if (!roots.has(rootId)) {
      roots.set(rootId, new Map());
      rootOrder.push(rootId);
    }
    const paths = roots.get(rootId)!;
    if (!paths.has(pathId)) {
      paths.set(pathId, { occurrences: [], distinct: new Map(), cycleDetected: false });
    }
    const result = paths.get(pathId)!;
    result.cycleDetected ||= asBoolean(metadata.cycleDetected);
    if (!asBoolean(metadata.hasTerminal)) return;

    const terminal: EntityTraversalTerminal = {
      context: metadata.terminalKind as EntityTraversalPathTerminal,
      id: String(metadata.terminalId),
      schemaId: String(metadata.terminalSchemaId),
      source: (projections.sources as Record<string, unknown> | undefined) ?? {}
    };
    const contexts = parseDelimited(metadata.provenanceContexts);
    const ids = parseDelimited(metadata.provenanceIds);
    const schemaIds = parseDelimited(metadata.provenanceSchemaIds);
    const provenance = ids.map((id, index) => ({
      context: (contexts[index] ?? 'entity') as EntityTraversalPathTerminal,
      id,
      schemaId: schemaIds[index] ?? ''
    }));
    const occurrence: EntityTraversalOccurrence = {
      rootId,
      pathId,
      terminal,
      provenance
    };
    result.occurrences.push(occurrence);
    const identity = `${terminal.context}:${terminal.id}`;
    if (!result.distinct.has(identity)) result.distinct.set(identity, terminal);
  });

  const pathOrder = plan.paths.map(path => path.id);
  return {
    roots: rootOrder.map(rootId => {
      const pathMap = roots.get(rootId)!;
      return {
        rootId,
        paths: pathOrder.map(pathId => {
          const path = pathMap.get(pathId) ?? {
            occurrences: [],
            distinct: new Map<string, EntityTraversalTerminal>(),
            cycleDetected: false
          };
          const occurrences = [...path.occurrences].sort(
            (left, right) =>
              left.provenance.length - right.provenance.length ||
              left.terminal.id.localeCompare(right.terminal.id)
          );
          const distinct = new Map<string, EntityTraversalTerminal>();
          occurrences.forEach(occurrence => {
            const key = `${occurrence.terminal.context}:${occurrence.terminal.id}`;
            if (!distinct.has(key)) distinct.set(key, occurrence.terminal);
          });
          return {
            pathId,
            occurrences,
            distinctTerminals: [...distinct.values()],
            duplicateCount: occurrences.length - distinct.size,
            cycleDetected: path.cycleDetected
          };
        })
      };
    })
  };
};

export const executeEntityTraversal = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext | null,
  plan: EntityTraversalPlan
): Promise<EntityTraversalResult> => {
  const [schemaRows, relationSchemaRows, collectionEntityIds] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace),
    plan.root.kind === 'entityQuery' && plan.root.entityQuery.collectionId && authCtx
      ? db.view.listCollectionEntityIds(
          authCtx.userId,
          workspace,
          plan.root.entityQuery.collectionId
        )
      : Promise.resolve(null)
  ]);
  const schemas: SchemaCatalog = new Map(schemaRows.map(schema => [schema.id, schema]));
  const relationSchemas: RelationSchemaCatalog = new Map(
    relationSchemaRows.map(schema => [schema.id, schema])
  );
  validateEntityTraversalPlan(plan, schemas, relationSchemas, authCtx);
  const compiled = compileTraversalSql(
    plan,
    schemas,
    relationSchemas,
    db.core.driver,
    workspace,
    authCtx,
    collectionEntityIds ?? undefined
  );
  const rows = await db.catalog.runCompiledEntityQuery(compiled.sql, compiled.params);
  return toTraversalResult(
    rows,
    plan,
    plan.maxDepth ?? DEFAULT_ENTITY_TRAVERSAL_MAX_DEPTH,
    plan.maxNodes ?? DEFAULT_ENTITY_TRAVERSAL_MAX_NODES
  );
};

export const compileEntityTraversal = (
  plan: EntityTraversalPlan,
  schemas: SchemaDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  dialect: 'postgres' | 'sqlite',
  workspace: string,
  authCtx: WorkspaceAuthorizationContext | null = null
): { sql: string; params: unknown[] } => {
  const schemaCatalog: SchemaCatalog = new Map(schemas.map(schema => [schema.id, schema]));
  const relationSchemaCatalog: RelationSchemaCatalog = new Map(
    relationSchemas.map(schema => [schema.id, schema])
  );
  validateEntityTraversalPlan(plan, schemaCatalog, relationSchemaCatalog, authCtx);
  return compileTraversalSql(
    plan,
    schemaCatalog,
    relationSchemaCatalog,
    dialect,
    workspace,
    authCtx,
    undefined
  );
};
