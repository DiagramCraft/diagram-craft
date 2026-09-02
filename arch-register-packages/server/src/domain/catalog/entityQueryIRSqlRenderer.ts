// Internal SQL renderer for the entity-query compilation plan.
//
// SQL emission is split across the context, predicate/path, projection, source, and assembly
// modules. This file intentionally remains the compatibility façade used by entityQueryIRCompiler.
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { EntityQueryDialect } from './entityQueryIRDialect';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';
import {
  buildEntityQueryPlanInputs,
  buildQueryFragments,
  renderEntityQueryCount,
  renderEntityQueryRows
} from './entityQueryIRSqlAssembly';
import type { CompiledEntityQuery, CompiledEntityQueryOptions } from './entityQueryIRSqlContext';

export type { CompiledEntityQuery, CompiledEntityQueryOptions } from './entityQueryIRSqlContext';

export const compileEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery => {
  const prepared = buildEntityQueryPlanInputs(query, schemas, relationSchemas, options, authCtx);
  return renderEntityQueryRows(
    buildQueryFragments(
      query,
      schemas,
      dialect,
      workspace,
      options,
      authCtx,
      relationSchemas,
      true,
      prepared
    )
  );
};

export const compileEntityQueryCountIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery => {
  const prepared = buildEntityQueryPlanInputs(query, schemas, relationSchemas, options, authCtx);
  return renderEntityQueryCount(
    buildQueryFragments(
      query,
      schemas,
      dialect,
      workspace,
      options,
      authCtx,
      relationSchemas,
      false,
      prepared
    )
  );
};

export type EntityQueryCompilationPair = {
  rowQuery: CompiledEntityQuery;
  countQuery: CompiledEntityQuery;
};

/**
 * Internal bulk-query entry point. Both output modes consume one semantic and permission plan;
 * only the final SQL rendering state (including parameters and projection CTEs) is independent.
 */
export const compileEntityQueryPair = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialect,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): EntityQueryCompilationPair => {
  const prepared = buildEntityQueryPlanInputs(query, schemas, relationSchemas, options, authCtx);
  const rowFragments = buildQueryFragments(
    query,
    schemas,
    dialect,
    workspace,
    options,
    authCtx,
    relationSchemas,
    true,
    prepared
  );
  const countFragments = buildQueryFragments(
    query,
    schemas,
    dialect,
    workspace,
    options,
    authCtx,
    relationSchemas,
    false,
    prepared
  );
  return {
    rowQuery: renderEntityQueryRows(rowFragments),
    countQuery: renderEntityQueryCount(countFragments)
  };
};
