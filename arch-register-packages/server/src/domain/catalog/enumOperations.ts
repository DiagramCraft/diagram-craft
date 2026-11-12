import { assertDirectSchemaChangeMode } from '../schemaDraft/schemaChangeMode';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildCreateEnumInput,
  buildUpdateEnumInput,
  isEnumReferencedBySchemas
} from './enumHelpers';
import { listUsedEnumOptionValues } from './enumUsage';
import { toApiEnum, type CategoryLookup } from './schemaHelpers';
import { assertCategoryExists, buildCategoryLookup } from './categoryOperations';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';
import { recordSnapshotVersion } from '../schemaDraft/snapshotVersions';
import { computeChanges, logAudit } from '../audit/db/auditLogging';
import {
  CreateEnumRequest,
  UpdateEnumRequest,
  WorkspaceEnum
} from '@arch-register/api-types/enumContract';

const dbErrorMessages = {
  unique: 'An enum with that name already exists in this workspace',
  foreign: 'Cannot delete enum: it is still referenced by a schema field'
} as const;

type EnumApplyContext = {
  userId: string;
  /** Set when applied as part of a schema draft publication. */
  publicationId?: string | null;
  /** Id for a created enum; defaults to a generated one. */
  id?: string;
};

const recordEnumVersion = (
  db: DatabaseAdapter,
  ws: string,
  row: WorkspaceEnumDbResult,
  ctx: EnumApplyContext,
  baseline?: WorkspaceEnumDbResult
) => recordSnapshotVersion(db, 'enum', ws, row, ctx, baseline);

/**
 * Authorization-free enum writes, shared by the direct operations and schema draft publish
 * (which passes its transaction handle as `db`).
 */
export const applyCreateEnum = async (
  db: DatabaseAdapter,
  ws: string,
  body: CreateEnumRequest,
  ctx: EnumApplyContext
) => {
  const input = { ...buildCreateEnumInput(ws, body, new Date()) };
  if (ctx.id) input.id = ctx.id;
  const categoryName = await assertCategoryExists(db, ws, input.category_id);
  const row = await db.catalog.createEnum(input);
  await recordEnumVersion(db, ws, row, ctx);
  await logAudit(db, {
    userId: ctx.userId,
    workspace: ws,
    operation: 'create',
    entityType: 'workspace_enum',
    entityId: row.id,
    entityName: row.name,
    changes: { new: row },
    metadata: { optionCount: row.options.length }
  });
  return { row, categoryName };
};

export const applyUpdateEnum = async (
  db: DatabaseAdapter,
  ws: string,
  id: string,
  body: UpdateEnumRequest,
  ctx: EnumApplyContext
) => {
  const oldRow = await db.catalog.getEnum(ws, id);
  httpAssert.present(oldRow, { status: 404, message: `Enum '${id}' not found` });

  const requestedValues = body.options
    ? new Set(body.options.map(option => option.value))
    : undefined;
  const hasRemovedOptions =
    requestedValues !== undefined &&
    oldRow.options.some(option => !requestedValues.has(option.value));
  const usedOptionValues = hasRemovedOptions
    ? await listUsedEnumOptionValues(db, ws, id)
    : undefined;

  const updateInput = buildUpdateEnumInput(body, oldRow, new Date(), usedOptionValues);
  const categoryName = await assertCategoryExists(db, ws, updateInput.category_id);
  const row = await db.catalog.updateEnum(ws, id, updateInput);
  httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
  await recordEnumVersion(db, ws, row, ctx, oldRow);
  await logAudit(db, {
    userId: ctx.userId,
    workspace: ws,
    operation: 'update',
    entityType: 'workspace_enum',
    entityId: row.id,
    entityName: row.name,
    changes: computeChanges(oldRow, row),
    metadata: { optionCount: row.options.length }
  });
  return { row, categoryName };
};

export const applyDeleteEnum = async (
  db: DatabaseAdapter,
  ws: string,
  id: string,
  ctx: EnumApplyContext
) => {
  const [schemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(ws),
    db.relation.listRelationSchemas(ws)
  ]);
  httpAssert.true(!isEnumReferencedBySchemas(schemas, id, relationSchemas), {
    status: 409,
    message: 'Cannot delete enum: it is still referenced by one or more schema fields'
  });

  const row = await db.catalog.getEnum(ws, id);
  httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });

  await db.catalog.deleteEnum(ws, id);
  await logAudit(db, {
    userId: ctx.userId,
    workspace: ws,
    operation: 'delete',
    entityType: 'workspace_enum',
    entityId: row.id,
    entityName: row.name,
    changes: { old: row },
    metadata: { optionCount: row.options.length }
  });
  return row;
};

export const listWorkspaceEnums = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve enums',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const [enums, categories] = await Promise.all([
        db.catalog.listEnums(ws),
        buildCategoryLookup(db, ws)
      ]);
      return enums.map(e => toApiEnum(e, categories));
    }
  });
};

export const getWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve enum',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const [row, categories] = await Promise.all([
        db.catalog.getEnum(ws, id),
        buildCategoryLookup(db, ws)
      ]);
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
      return toApiEnum(row, categories);
    }
  });
};

export const createWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateEnumRequest,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create enum',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      const { row, categoryName } = await applyCreateEnum(db, ws, body, {
        userId: authCtx.userId
      });
      const categories: CategoryLookup =
        row.category_id && categoryName ? new Map([[row.category_id, categoryName]]) : new Map();
      return toApiEnum(row, categories);
    }
  });
};

export const updateWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateEnumRequest,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update enum',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      const { row, categoryName } = await applyUpdateEnum(db, ws, id, body, {
        userId: authCtx.userId
      });
      const categories: CategoryLookup =
        row.category_id && categoryName ? new Map([[row.category_id, categoryName]]) : new Map();
      return toApiEnum(row, categories);
    }
  });
};

export const deleteWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete enum',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      await applyDeleteEnum(db, ws, id, { userId: authCtx.userId });
      return { success: true, message: `Enum '${id}' deleted` };
    }
  });
};
