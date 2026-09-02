import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  buildEntityQueryPermissionPlan,
  requiresRecursiveEntityQueryWith
} from './entityQueryIRPermissionPlan';
import { buildEntityQuerySemanticPlan } from './entityQueryIRPlan';
import type { EntityQueryDialect } from './entityQueryIRDialect';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';
import {
  addParam,
  createEntityQuerySqlRenderState,
  RELATION_SCOPE_CTE,
  ROOT_ALIAS,
  SCOPE_CTE,
  type CompiledEntityQuery,
  type CompiledEntityQueryOptions,
  type EntityQueryPlanInputs,
  type EntityQuerySqlRenderState
} from './entityQueryIRSqlContext';
import { compileNode } from './entityQueryIRSqlPredicates';
import { buildProjectionBindings, compileProjectionObject } from './entityQueryIRSqlProjections';
import { buildRelationScopeCte, buildScopeCte } from './entityQueryIRSqlSources';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';

export const buildEntityQueryPlanInputs = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  options: CompiledEntityQueryOptions,
  authCtx: WorkspaceAuthorizationContext | null
): EntityQueryPlanInputs => ({
  semanticPlan: buildEntityQuerySemanticPlan(query, schemas, relationSchemas, authCtx),
  permissionPlan: buildEntityQueryPermissionPlan(query, options, authCtx)
});

export const buildQueryFragments = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions,
  authCtx: WorkspaceAuthorizationContext | null,
  relationSchemas: RelationSchemaCatalog,
  includeProjections = true,
  prepared?: EntityQueryPlanInputs
) => {
  const planInputs =
    prepared ?? buildEntityQueryPlanInputs(query, schemas, relationSchemas, options, authCtx);
  const { semanticPlan, permissionPlan } = planInputs;
  const state = createEntityQuerySqlRenderState({
    query,
    schemas,
    relationSchemas,
    dialect,
    workspace,
    semanticPlan,
    permissionPlan
  });

  if (state.asOf && Number.isNaN(state.asOf.getTime())) {
    throw new UnsupportedEntityQueryIRError(`Invalid asOf date '${query.asOf}'`);
  }

  // Keep this order stable: every builder receives the same allocator, and SQLite's positional
  // placeholders make SQL construction order observable in the params array.
  const cte = buildScopeCte(state);
  const relationCte = buildRelationScopeCte(state);
  const projectionCtes = includeProjections ? buildProjectionBindings(query, state) : [];
  const projectionObject = includeProjections
    ? compileProjectionObject(query.projections ?? [], state)
    : '';
  const whereParts: string[] = [];
  if (query.schemaId) {
    whereParts.push(`${ROOT_ALIAS}.schema_id = ${addParam(state, query.schemaId)}`);
  }
  whereParts.push(compileNode(query.root, ROOT_ALIAS, state, true));

  const needsRecursiveWith = requiresRecursiveEntityQueryWith(state);
  const withClause = `WITH${needsRecursiveWith ? ' RECURSIVE' : ''} ${cte},\n    ${relationCte}${projectionCtes.length > 0 ? `,\n    ${projectionCtes.join(',\n    ')}` : ''}`;

  return { rootKind: state.rootKind, state, withClause, whereParts, projectionObject };
};

export type EntityQueryFragments = ReturnType<typeof buildQueryFragments>;

const renderLimitOffset = (state: EntityQuerySqlRenderState): string =>
  state.limit != null
    ? `\n    LIMIT ${addParam(state, state.limit)}${state.offset != null ? ` OFFSET ${addParam(state, state.offset)}` : ''}`
    : state.offset != null
      ? `\n    LIMIT ${state.dialectAdapter.limitAll} OFFSET ${addParam(state, state.offset)}`
      : '';

export const renderEntityQueryRows = (fragments: EntityQueryFragments): CompiledEntityQuery => {
  const { rootKind, state, withClause, whereParts, projectionObject } = fragments;
  const limitOffsetClause = renderLimitOffset(state);

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
      wo.name    AS owner_name,
      ls.label   AS lifecycle_label,
      ${projectionObject} AS projections
    FROM ${RELATION_SCOPE_CTE} ${ROOT_ALIAS}
    JOIN relation_schema rs        ON rs.id = ${ROOT_ALIAS}.schema_id
    LEFT JOIN catalog_record in_e  ON in_e.id = ${ROOT_ALIAS}.in_record_id
    LEFT JOIN catalog_record out_e ON out_e.id = ${ROOT_ALIAS}.out_record_id
    LEFT JOIN workspace_owner wo           ON wo.id = ${ROOT_ALIAS}.owner
    LEFT JOIN workspace_lifecycle_state ls ON ls.id = ${ROOT_ALIAS}.lifecycle
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
    ORDER BY ${ROOT_ALIAS}.name, ${ROOT_ALIAS}.id${limitOffsetClause}
  `;

  return { sql, params: state.parameters.values };
};

export const renderEntityQueryCount = (fragments: EntityQueryFragments): CompiledEntityQuery => {
  const { rootKind, state, withClause, whereParts } = fragments;
  const sql =
    rootKind === 'relation'
      ? `
    ${withClause}
    SELECT COUNT(*) AS count
    FROM ${RELATION_SCOPE_CTE} ${ROOT_ALIAS}
    JOIN relation_schema rs        ON rs.id = ${ROOT_ALIAS}.schema_id
    LEFT JOIN catalog_record in_e  ON in_e.id = ${ROOT_ALIAS}.in_record_id
    LEFT JOIN catalog_record out_e ON out_e.id = ${ROOT_ALIAS}.out_record_id
    WHERE ${whereParts.join(' AND ')}
  `
      : `
    ${withClause}
    SELECT COUNT(*) AS count
    FROM ${SCOPE_CTE} ${ROOT_ALIAS}
    JOIN entity_schema es ON es.id = ${ROOT_ALIAS}.schema_id
    WHERE ${whereParts.join(' AND ')}
  `;

  return { sql, params: state.parameters.values };
};
