import {
  buildEntityDrawerCatalog,
  entityDrawerConfigurationSchema,
  resolveEntityDrawerConfiguration,
  type EntityDrawerConfiguration
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { PermissionChecker, type WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { createEntityDrawerQueryValidator } from './entityDrawerQueryValidation';

type EntityDrawerResource = {
  stored_configuration: unknown | null;
  effective_configuration: EntityDrawerConfiguration;
  diagnostics: ReturnType<typeof resolveEntityDrawerConfiguration>['diagnostics'];
  updated_at: Date | null;
};

const runEntityDrawerOperation = <Result>(
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  operation: (ws: string, authCtx: WorkspaceAuthorizationContext) => Promise<Result>
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: ({ ws, authCtx }) => operation(ws, authCtx)
  });

const loadSchemas = (db: DatabaseAdapter, workspace: string) => db.catalog.listSchemas(workspace);
const permissionChecker = new PermissionChecker();

const requireEntityDrawerWrite = (authCtx: WorkspaceAuthorizationContext) => {
  httpAssert.true(
    permissionChecker.hasWorkspaceCapability(authCtx, 'ws.settings') ||
      permissionChecker.hasWorkspaceCapability(authCtx, 'schema.edit'),
    { status: 403, statusText: 'Forbidden', message: 'Entity drawer administration required' }
  );
};

const getResource = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext
): Promise<EntityDrawerResource> => {
  const [row, schemas, enums, relationSchemaRows, capabilityConfigurations] = await Promise.all([
    db.workspace.getWorkspaceEntityDrawerConfiguration(workspace),
    loadSchemas(db, workspace),
    db.catalog.listEnums(workspace),
    db.relation.listRelationSchemas(workspace),
    db.workspace.listWorkspaceCapabilityConfigurations(workspace)
  ]);
  const relationSchemas = relationSchemaRows.map(relationSchema => ({
    id: relationSchema.id,
    in: { schemaIds: relationSchema.in_schema_ids },
    out: { schemaIds: relationSchema.out_schema_ids }
  }));
  const queryValidator = createEntityDrawerQueryValidator(
    { schemas, enums, relationSchemas: relationSchemaRows },
    authCtx
  );
  const resolved = resolveEntityDrawerConfiguration(
    row?.configuration ?? null,
    schemas,
    capabilityConfigurations,
    relationSchemas,
    queryValidator
  );
  return {
    stored_configuration: row?.configuration ?? null,
    effective_configuration: resolved.effective,
    diagnostics: resolved.diagnostics,
    updated_at: row?.updated_at ?? null
  };
};

export const getEntityDrawerConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runEntityDrawerOperation(db, workspace, event, async (ws, authCtx) => {
    requireWorkspaceCapability(authCtx, 'ws.view');
    return await getResource(db, ws, authCtx);
  });

export const getEntityDrawerCatalog = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runEntityDrawerOperation(db, workspace, event, async (ws, authCtx) => {
    requireWorkspaceCapability(authCtx, 'ws.view');
    const [schemas, capabilityConfigurations] = await Promise.all([
      loadSchemas(db, ws),
      db.workspace.listWorkspaceCapabilityConfigurations(ws)
    ]);
    return buildEntityDrawerCatalog(schemas, capabilityConfigurations);
  });

export const updateEntityDrawerConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  input: EntityDrawerConfiguration,
  event: AuthenticatedEvent
) =>
  runEntityDrawerOperation(db, workspace, event, async (ws, authCtx) => {
    requireEntityDrawerWrite(authCtx);
    const parsed = entityDrawerConfigurationSchema.safeParse(input);
    httpAssert.true(parsed.success, {
      status: 400,
      message: 'Invalid entity drawer configuration'
    });
    const [schemas, enums, relationSchemaRows, capabilityConfigurations] = await Promise.all([
      loadSchemas(db, ws),
      db.catalog.listEnums(ws),
      db.relation.listRelationSchemas(ws),
      db.workspace.listWorkspaceCapabilityConfigurations(ws)
    ]);
    const relationSchemas = relationSchemaRows.map(relationSchema => ({
      id: relationSchema.id,
      in: { schemaIds: relationSchema.in_schema_ids },
      out: { schemaIds: relationSchema.out_schema_ids }
    }));
    const queryValidator = createEntityDrawerQueryValidator(
      { schemas, enums, relationSchemas: relationSchemaRows },
      authCtx
    );
    const validation = resolveEntityDrawerConfiguration(
      parsed.data,
      schemas,
      capabilityConfigurations,
      relationSchemas,
      queryValidator
    );
    const queryErrors = validation.diagnostics.filter(
      diagnostic => diagnostic.code === 'invalid_query'
    );
    httpAssert.true(queryErrors.length === 0, {
      status: 400,
      message: queryErrors.map(diagnostic => diagnostic.message).join('; ')
    });
    const now = new Date();
    await db.workspace.upsertWorkspaceEntityDrawerConfiguration({
      workspace: ws,
      configuration: parsed.data,
      created_at: now,
      updated_at: now
    });
    return await getResource(db, ws, authCtx);
  });

export const resetEntityDrawerConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runEntityDrawerOperation(db, workspace, event, async (ws, authCtx) => {
    requireEntityDrawerWrite(authCtx);
    await db.workspace.deleteWorkspaceEntityDrawerConfiguration(ws);
    return { success: true as const };
  });
