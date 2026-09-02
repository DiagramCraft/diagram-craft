import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityViewPermissionScope } from './db/entityPermissionScope';
import type { TypedRelationVisibilityPolicy } from './relationAccessControl';
import {
  createEntityQueryDialectAdapter,
  type EntityQueryDialect,
  type EntityQueryDialectAdapter
} from './entityQueryIRDialect';
import type {
  EntityQuerySemanticPlan,
  ProjectionPathSchemaInfo,
  RelationRootTemporalCandidate,
  RelationSourceConstraint
} from './entityQueryIRPlan';
import type { EntityQueryPermissionPlan } from './entityQueryIRPermissionPlan';
import type { ProjectionBinding } from './entityQueryIRProjectionPlan';
import type {
  QueryRootKind,
  RelationSchemaCatalog,
  SchemaCatalog
} from './entityQueryIRResolution';

export const SCOPE_CTE = 'scoped_entity';
export const RELATION_SCOPE_CTE = 'scoped_relation';
export const ROOT_ALIAS = 'e0';

export const ENTITY_CONFORMANCE_FIELD_IDS = new Set([
  '_conformanceStatus',
  '_conformanceEvaluatedAt',
  '_conformanceStale'
]);

export type CompiledEntityQuery = { sql: string; params: unknown[] };

export type CompiledEntityQueryOptions = {
  visibleEntityIds?: readonly string[];
  permissionScope?: EntityViewPermissionScope | null;
  // Additional entity-id scope, used for user collection membership. Keeping this in the scope
  // CTE ensures SQL pagination and COUNT(*) see the same candidate set.
  collectionEntityIds?: readonly string[];
  // Relation-root visibility policy. It is compiled to SQL against the relation's endpoint
  // schema ids and owner, avoiding a workspace-wide relation scan and large id-list parameter.
  relationVisibility?: TypedRelationVisibilityPolicy;
  // SQL-level pagination for both entity- and relation-rooted paths. The caller supplies the
  // normalized page window; COUNT(*) queries omit these options.
  limit?: number;
  offset?: number;
};

export type SqlParameterAllocator = {
  readonly values: unknown[];
  add: (value: unknown) => string;
};

export type EntityQuerySqlRenderState = EntityQueryPermissionPlan & {
  query: EntityQuery;
  schemas: SchemaCatalog;
  relationSchemas: RelationSchemaCatalog;
  dialect: EntityQueryDialect;
  dialectAdapter: EntityQueryDialectAdapter;
  workspace: string;
  rootKind: QueryRootKind;
  parameters: SqlParameterAllocator;
  nextAliasIndex: number;
  nextRelationAliasIndex: number;
  projectionBindings: ProjectionBinding[];
  bindingByPath: Map<string, ProjectionBinding>;
  projectionPathSchemas: Map<string, ProjectionPathSchemaInfo>;
  compilingBinding: boolean;
  semanticPlan: EntityQuerySemanticPlan;
  permissionPlan: EntityQueryPermissionPlan;
  relationSourceConstraints: readonly RelationSourceConstraint[];
  relationRootTemporalCandidate: RelationRootTemporalCandidate | null;
};

export type EntityQueryPlanInputs = {
  semanticPlan: EntityQuerySemanticPlan;
  permissionPlan: EntityQueryPermissionPlan;
};

export const createSqlParameterAllocator = (
  dialectAdapter: EntityQueryDialectAdapter
): SqlParameterAllocator => {
  const values: unknown[] = [];
  return {
    values,
    add: value => {
      values.push(value);
      return dialectAdapter.placeholder(values.length);
    }
  };
};

export const addParam = (state: EntityQuerySqlRenderState, value: unknown): string =>
  state.parameters.add(value);

export const nextAlias = (state: EntityQuerySqlRenderState): string => `e${state.nextAliasIndex++}`;

export const nextRelationAlias = (state: EntityQuerySqlRenderState): string =>
  `r${state.nextRelationAliasIndex++}`;

export const createEntityQuerySqlRenderState = ({
  query,
  schemas,
  relationSchemas,
  dialect,
  workspace,
  semanticPlan,
  permissionPlan
}: {
  query: EntityQuery;
  schemas: SchemaCatalog;
  relationSchemas: RelationSchemaCatalog;
  dialect: EntityQueryDialect;
  workspace: string;
  semanticPlan: EntityQuerySemanticPlan;
  permissionPlan: EntityQueryPermissionPlan;
}): EntityQuerySqlRenderState => {
  const dialectAdapter = createEntityQueryDialectAdapter(dialect);
  return {
    ...permissionPlan,
    query,
    schemas,
    relationSchemas,
    dialect,
    dialectAdapter,
    workspace,
    rootKind: semanticPlan.rootKind,
    parameters: createSqlParameterAllocator(dialectAdapter),
    nextAliasIndex: 1,
    nextRelationAliasIndex: 1,
    projectionBindings: [],
    bindingByPath: new Map(),
    projectionPathSchemas: new Map(),
    compilingBinding: false,
    semanticPlan,
    permissionPlan,
    relationSourceConstraints: semanticPlan.relationSourceConstraints,
    relationRootTemporalCandidate: semanticPlan.relationRootTemporalCandidate
  };
};
