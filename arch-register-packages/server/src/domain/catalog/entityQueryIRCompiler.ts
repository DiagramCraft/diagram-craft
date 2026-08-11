/**
 * Public façade for entity-query IR compilation.
 *
 * SQL generation lives in the staged renderer; these wrappers keep the existing compiler API
 * stable while the internal pipeline evolves.
 */
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type {
  RelationSchemaCatalog,
  SchemaCatalog
} from './entityQueryIRResolution';
import type { EntityQueryDialect as EntityQueryDialectType } from './entityQueryIRDialect';
import {
  compileEntityQueryIR as renderEntityQueryIR,
  compileEntityQueryCountIR as renderEntityQueryCountIR,
  compileEntityQueryPair as renderEntityQueryPair
} from './entityQueryIRSqlRenderer';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';
import type {
  CompiledEntityQuery as RendererCompiledEntityQuery,
  CompiledEntityQueryOptions as RendererCompiledEntityQueryOptions,
  EntityQueryCompilationPair as RendererEntityQueryCompilationPair
} from './entityQueryIRSqlRenderer';

export type EntityQueryDialect = EntityQueryDialectType;
export type CompiledEntityQuery = RendererCompiledEntityQuery;
export type CompiledEntityQueryOptions = RendererCompiledEntityQueryOptions;
export type EntityQueryCompilationPair = RendererEntityQueryCompilationPair;

export { UnsupportedEntityQueryIRError };

export const compileEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialectType,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery =>
  renderEntityQueryIR(query, schemas, dialect, workspace, options, authCtx, relationSchemas);

export const compileEntityQueryCountIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialectType,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): CompiledEntityQuery =>
  renderEntityQueryCountIR(query, schemas, dialect, workspace, options, authCtx, relationSchemas);

export const compileEntityQueryPair = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  dialect: EntityQueryDialectType,
  workspace: string,
  options: CompiledEntityQueryOptions = {},
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): EntityQueryCompilationPair =>
  renderEntityQueryPair(query, schemas, dialect, workspace, options, authCtx, relationSchemas);
