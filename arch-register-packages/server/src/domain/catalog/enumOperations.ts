import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability } from '../auth/authorization';
import { defineOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildCreateEnumInput,
  buildUpdateEnumInput,
  isEnumReferencedBySchemas
} from './enumHelpers';
import { toApiEnum } from './schemaHelpers';
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
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve enums',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const enums = await db.catalog.listEnums(ws);
      return enums.map(toApiEnum);
    }
  );
};

export const getWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve enum',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const row = await db.catalog.getEnum(ws, id);
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
      return toApiEnum(row);
    }
  );
};

export const createWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateEnumRequest,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create enum',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const timestamp = new Date();
      const row = await db.catalog.createEnum(buildCreateEnumInput(ws, body, timestamp));
      return toApiEnum(row);
    }
  );
};

export const updateWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateEnumRequest,
  event: AuthenticatedEvent
): Promise<WorkspaceEnum> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update enum',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldRow = await db.catalog.getEnum(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Enum '${id}' not found` });

      const row = await db.catalog.updateEnum(
        ws,
        id,
        buildUpdateEnumInput(body, oldRow, new Date())
      );
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
      return toApiEnum(row);
    }
  );
};

export const deleteWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to delete enum',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schemas = await db.catalog.listSchemas(ws);
      httpAssert.true(!isEnumReferencedBySchemas(schemas, id), {
        status: 409,
        message: 'Cannot delete enum: it is still referenced by one or more schema fields'
      });

      const row = await db.catalog.getEnum(ws, id);
      httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });

      await db.catalog.deleteEnum(ws, id);
      return { success: true, message: `Enum '${id}' deleted` };
    }
  );
};
