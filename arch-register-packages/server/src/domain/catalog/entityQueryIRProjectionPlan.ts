import type {
  EntityQuery,
  PathStep,
  ProjectionField
} from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';
import {
  collectRootPathOccurrences,
  entityQueryPathKey,
  entityQueryPathStartsWith,
  relationPathIsMultiValued,
  type EntityQuerySemanticPlan,
  type ProjectionPathSchemaInfo
} from './entityQueryIRPlan';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';

export type ProjectionBinding = {
  name: string;
  path: PathStep[];
};

export type EntityQueryProjectionPlan = {
  bindings: readonly ProjectionBinding[];
  bindingByPath: ReadonlyMap<string, ProjectionBinding>;
  projectionPathSchemas: ReadonlyMap<string, ProjectionPathSchemaInfo>;
};

export const effectiveProjectionAlias = (projection: ProjectionField): string => {
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
        case 'relationForward':
          return step.fieldId;
        case 'relationBackward':
          return `<-${step.relationSchemaId}.${step.fieldId}`;
      }
    })
    .join('.');
  return path ? `${path}.${projection.fieldId}` : projection.fieldId;
};

/**
 * Decide which traversals need reusable binding CTEs. This is pure planning: SQL aliases and
 * parameters are assigned later by the renderer. The same path-prefix and multi-valued-path
 * rules used by the previous compiler are retained here.
 */
export const buildEntityQueryProjectionPlan = (
  query: EntityQuery,
  semanticPlan: EntityQuerySemanticPlan,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): EntityQueryProjectionPlan => {
  const rootPaths: PathStep[][] = [];
  collectRootPathOccurrences(query.root, rootPaths);
  const pathsToBind = new Map<string, PathStep[]>();

  for (const path of rootPaths) pathsToBind.set(entityQueryPathKey(path), path);

  for (const projection of query.projections ?? []) {
    if (projection.path.length === 0) continue;
    const candidates = rootPaths.filter(path => entityQueryPathStartsWith(path, projection.path));
    if (
      candidates.length > 1 &&
      (semanticPlan.projectionPathCardinality.get(entityQueryPathKey(projection.path)) ??
        relationPathIsMultiValued(projection.path, schemas, relationSchemas))
    ) {
      throw new UnsupportedEntityQueryIRError(
        `Projection '${effectiveProjectionAlias(projection)}' is ambiguous because its multi-valued relation path is constrained by multiple independent predicates`
      );
    }
    if (candidates.length === 0)
      pathsToBind.set(entityQueryPathKey(projection.path), projection.path);
  }

  const bindings = [...pathsToBind.values()].map((path, index) => ({
    name: `query_path_${index}`,
    path
  }));

  return {
    bindings,
    bindingByPath: new Map(bindings.map(binding => [entityQueryPathKey(binding.path), binding])),
    projectionPathSchemas: semanticPlan.projectionPathSchemas
  };
};
