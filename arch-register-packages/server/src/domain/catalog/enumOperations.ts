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
import { toApiEnum } from './schemaHelpers';
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
      const enums = await db.catalog.listEnums(ws);
      return enums.map(toApiEnum);
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
      const row = await db.catalog.getEnum(ws, id);
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
      return toApiEnum(row);
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
      const timestamp = new Date();
      const row = await db.catalog.createEnum(buildCreateEnumInput(ws, body, timestamp));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'workspace_enum',
        entityId: row.id,
        entityName: row.name,
        changes: { new: row },
        metadata: { optionCount: row.options.length }
      });
      return toApiEnum(row);
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

      const row = await db.catalog.updateEnum(
        ws,
        id,
        buildUpdateEnumInput(body, oldRow, new Date(), usedOptionValues)
      );
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'workspace_enum',
        entityId: row.id,
        entityName: row.name,
        changes: computeChanges(oldRow, row),
        metadata: { optionCount: row.options.length }
      });
      return toApiEnum(row);
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
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'workspace_enum',
        entityId: row.id,
        entityName: row.name,
        changes: { old: row },
        metadata: { optionCount: row.options.length }
      });
      return { success: true, message: `Enum '${id}' deleted` };
    }
  });
};
