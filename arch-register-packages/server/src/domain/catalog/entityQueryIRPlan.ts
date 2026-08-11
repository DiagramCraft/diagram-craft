import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  availableSchemaIds,
  kindAfterPath,
  relationFieldById,
  resolveEndpointSchemaIds,
  resolveEntityQueryRootKind,
  resolveRelationFieldSchemaScope,
  schemaFieldById,
  type QueryRootKind,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRResolution';

export type ProjectionPathSchemaInfo = {
  entitySchemaIdsByStep: readonly (readonly string[])[];
  terminalEntitySchemaIds: readonly string[];
};

export type RelationSourceConstraint = {
  relationSchemaId: string;
  ownerDirection?: 'in' | 'out';
  ownerSchemaIds?: readonly string[];
};

export type RelationRootTemporalCandidate = {
  relationSchemaIds: readonly string[];
  relationIds: readonly string[];
  inEntityIds: readonly string[];
  outEntityIds: readonly string[];
};

export type EntityQuerySemanticPlan = {
  rootKind: QueryRootKind;
  relationSourceConstraints: readonly RelationSourceConstraint[];
  relationRootTemporalCandidate: RelationRootTemporalCandidate | null;
  projectionPathSchemas: ReadonlyMap<string, ProjectionPathSchemaInfo>;
  projectionPathCardinality: ReadonlyMap<string, boolean>;
};

export const entityQueryPathKey = (path: PathStep[]): string => JSON.stringify(path);

export const entityQueryPathStartsWith = (path: PathStep[], prefix: PathStep[]): boolean =>
  prefix.every((step, index) => JSON.stringify(path[index]) === JSON.stringify(step));

export const collectRootPathOccurrences = (node: QueryNode, occurrences: PathStep[][]): void => {
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
    case 'freeText':
      return;
  }
};

const collectRelationSourceConstraintsFromPath = (
  path: PathStep[],
  constraints: Map<string, RelationSourceConstraint>
): void => {
  path.forEach(step => {
    if (step.kind === 'typedRelation') {
      const constraint: RelationSourceConstraint = {
        relationSchemaId: step.relationSchemaId,
        ownerDirection: step.direction,
        ownerSchemaIds: step.ownerSchemaIds
      };
      constraints.set(JSON.stringify(constraint), constraint);
    }
    if (step.kind !== 'endpoint' && step.filter) {
      collectRelationSourceConstraintsFromNode(step.filter, constraints);
    }
  });
};

const collectRelationSourceConstraintsFromNode = (
  node: QueryNode,
  constraints: Map<string, RelationSourceConstraint>
): void => {
  switch (node.kind) {
    case 'and':
    case 'or':
      node.children.forEach(child => collectRelationSourceConstraintsFromNode(child, constraints));
      return;
    case 'not':
      collectRelationSourceConstraintsFromNode(node.child, constraints);
      return;
    case 'predicate':
    case 'relationExists':
      collectRelationSourceConstraintsFromPath(node.path, constraints);
      return;
    case 'freeText':
      return;
  }
};

export const collectRelationSourceConstraints = (
  query: EntityQuery,
  rootKind: QueryRootKind
): readonly RelationSourceConstraint[] => {
  const constraints = new Map<string, RelationSourceConstraint>();
  if (rootKind === 'relation' && query.schemaId) {
    const constraint: RelationSourceConstraint = { relationSchemaId: query.schemaId };
    constraints.set(JSON.stringify(constraint), constraint);
  }

  collectRelationSourceConstraintsFromNode(query.root, constraints);
  query.projections?.forEach(projection =>
    collectRelationSourceConstraintsFromPath(projection.path, constraints)
  );

  return [...constraints.values()];
};

const isStringValue = (value: unknown): value is string => typeof value === 'string';

/**
 * Extract only positive, pathless identity predicates. These candidates narrow temporal relation
 * reconstruction; OR and NOT branches are deliberately ignored because they cannot safely narrow
 * the source without changing query semantics.
 */
export const collectRelationRootTemporalCandidate = (
  query: EntityQuery,
  rootKind: QueryRootKind,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): RelationRootTemporalCandidate | null => {
  if (rootKind !== 'relation') return null;

  const relationSchemaIds = new Set<string>();
  const relationIds = new Set<string>();
  const inEntityIds = new Set<string>();
  const outEntityIds = new Set<string>();

  if (query.schemaId) relationSchemaIds.add(query.schemaId);

  const collect = (node: QueryNode): void => {
    switch (node.kind) {
      case 'and':
        node.children.forEach(collect);
        return;
      case 'or':
      case 'not':
        return;
      case 'predicate': {
        if (node.path.length > 0) return;
        if (node.op === 'equals' && isStringValue(node.value)) {
          if (node.fieldId === '_schemaId') relationSchemaIds.add(node.value);
          if (node.fieldId === '_id') relationIds.add(node.value);
          if (node.fieldId === '_inEntityId') inEntityIds.add(node.value);
          if (node.fieldId === '_outEntityId') outEntityIds.add(node.value);
        }

        const scope = resolveRelationFieldSchemaScope(node.fieldId, relationSchemas, authCtx);
        if (scope.needsScoping) scope.grantedSchemaIds.forEach(id => relationSchemaIds.add(id));
        return;
      }
      case 'relationExists':
      case 'freeText':
        return;
    }
  };
  collect(query.root);

  if (
    relationSchemaIds.size === 0 &&
    relationIds.size === 0 &&
    inEntityIds.size === 0 &&
    outEntityIds.size === 0
  ) {
    return null;
  }

  return {
    relationSchemaIds: [...relationSchemaIds],
    relationIds: [...relationIds],
    inEntityIds: [...inEntityIds],
    outEntityIds: [...outEntityIds]
  };
};

export const relationPathIsMultiValued = (
  path: PathStep[],
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): boolean =>
  path.some(step => {
    if (step.kind === 'typedRelation') return true;
    if (step.kind === 'endpoint') return false;
    if (step.kind === 'relationBackward') return true;
    if (step.kind === 'relationForward') {
      const fields = [...relationSchemas.values()].map(schema =>
        relationFieldById(schema, step.fieldId)
      );
      return fields.some(
        field => field !== undefined && field.type === 'entityRelation' && field.maxCount !== 1
      );
    }
    const fields =
      step.kind === 'backward'
        ? [schemaFieldById(schemas.get(step.ownerSchemaId), step.fieldId)]
        : [...schemas.values()].map(schema => schemaFieldById(schema, step.fieldId));
    return fields.some(
      field => field !== undefined && isReferenceOrContainmentField(field) && field.maxCount !== 1
    );
  });

export const resolveProjectionPathSchemaInfo = (
  path: PathStep[],
  query: EntityQuery,
  rootKind: QueryRootKind,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): ProjectionPathSchemaInfo => {
  let currentEntitySchemaIds =
    rootKind === 'entity'
      ? availableSchemaIds(
          query.schemaId && schemas.has(query.schemaId) ? [query.schemaId] : schemas.keys(),
          schemas
        )
      : [];
  let currentRelationSchemaIds =
    rootKind === 'relation'
      ? availableSchemaIds(
          query.schemaId && relationSchemas.has(query.schemaId)
            ? [query.schemaId]
            : relationSchemas.keys(),
          relationSchemas
        )
      : [];
  let currentKind = rootKind;
  const entitySchemaIdsByStep: (readonly string[])[] = [];

  for (const step of path) {
    if (step.kind === 'endpoint') {
      const targetSchemaIds = currentRelationSchemaIds.flatMap(schemaId => {
        const schema = relationSchemas.get(schemaId);
        const endpointSchemaIds =
          step.direction === 'in' ? schema?.in_schema_ids : schema?.out_schema_ids;
        return [...resolveEndpointSchemaIds(endpointSchemaIds, schemas)];
      });
      currentEntitySchemaIds = availableSchemaIds(targetSchemaIds, schemas);
      currentRelationSchemaIds = [];
      currentKind = 'entity';
      entitySchemaIdsByStep.push(currentEntitySchemaIds);
      continue;
    }

    if (step.kind === 'typedRelation') {
      const relationSchema = relationSchemas.get(step.relationSchemaId);
      const endpointSchemaIds =
        step.direction === 'out' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
      const targetSchemaIds = [...resolveEndpointSchemaIds(endpointSchemaIds, schemas)];
      currentEntitySchemaIds = availableSchemaIds(targetSchemaIds, schemas);
      currentRelationSchemaIds = [];
      currentKind = 'entity';
      entitySchemaIdsByStep.push(currentEntitySchemaIds);
      continue;
    }

    if (step.kind === 'backward') {
      currentEntitySchemaIds = availableSchemaIds([step.ownerSchemaId], schemas);
      currentRelationSchemaIds = [];
      currentKind = 'entity';
      entitySchemaIdsByStep.push(currentEntitySchemaIds);
      continue;
    }

    if (step.kind === 'relationForward') {
      const targetSchemaIds = currentRelationSchemaIds.flatMap(schemaId => {
        const schema = relationSchemas.get(schemaId);
        const field = relationFieldById(schema, step.fieldId);
        return field && field.type === 'entityRelation' ? [field.schemaId] : [];
      });
      currentEntitySchemaIds = availableSchemaIds(targetSchemaIds, schemas);
      currentRelationSchemaIds = [];
      currentKind = 'entity';
      entitySchemaIdsByStep.push(currentEntitySchemaIds);
      continue;
    }

    if (step.kind === 'relationBackward') {
      currentRelationSchemaIds = availableSchemaIds([step.relationSchemaId], relationSchemas);
      currentEntitySchemaIds = [];
      currentKind = 'relation';
      entitySchemaIdsByStep.push([]);
      continue;
    }

    const targetSchemaIds = currentEntitySchemaIds.flatMap(schemaId => {
      const schema = schemas.get(schemaId);
      const field = schemaFieldById(schema, step.fieldId);
      return field && isReferenceOrContainmentField(field) ? [field.schemaId] : [];
    });
    currentEntitySchemaIds = availableSchemaIds(targetSchemaIds, schemas);
    currentRelationSchemaIds = [];
    currentKind = 'entity';
    entitySchemaIdsByStep.push(currentEntitySchemaIds);
  }

  return {
    entitySchemaIdsByStep,
    terminalEntitySchemaIds: currentKind === 'entity' ? currentEntitySchemaIds : []
  };
};

const collectProjectionPaths = (query: EntityQuery): Map<string, PathStep[]> => {
  const paths = new Map<string, PathStep[]>();
  const rootPaths: PathStep[][] = [];
  collectRootPathOccurrences(query.root, rootPaths);
  for (const path of rootPaths) paths.set(entityQueryPathKey(path), path);
  for (const projection of query.projections ?? []) {
    if (projection.path.length > 0) paths.set(entityQueryPathKey(projection.path), projection.path);
  }
  return paths;
};

export const buildEntityQuerySemanticPlan = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): EntityQuerySemanticPlan => {
  const rootKind = resolveEntityQueryRootKind(query, schemas, relationSchemas).rootKind;
  const projectionPaths = collectProjectionPaths(query);
  const projectionPathSchemas = new Map<string, ProjectionPathSchemaInfo>();
  for (const [key, path] of projectionPaths) {
    projectionPathSchemas.set(
      key,
      resolveProjectionPathSchemaInfo(path, query, rootKind, schemas, relationSchemas)
    );
  }

  const projectionPathCardinality = new Map<string, boolean>();
  for (const projection of query.projections ?? []) {
    projectionPathCardinality.set(
      entityQueryPathKey(projection.path),
      relationPathIsMultiValued(projection.path, schemas, relationSchemas)
    );
  }

  return {
    rootKind,
    relationSourceConstraints: collectRelationSourceConstraints(query, rootKind),
    relationRootTemporalCandidate: collectRelationRootTemporalCandidate(
      query,
      rootKind,
      relationSchemas,
      authCtx
    ),
    projectionPathSchemas,
    projectionPathCardinality
  };
};

export { kindAfterPath };
