import type { DatabaseAdapter } from '../../db/database';
import { handleDbError } from '../../utils/http';
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

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'An enum with that name already exists in this workspace',
    foreign: 'Cannot delete enum: it is still referenced by a schema field'
  });

export const listWorkspaceEnums = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<WorkspaceEnum[]> => {
  try {
    const enums = await db.catalog.listEnums(workspace);
    return enums.map(toApiEnum);
  } catch (error) {
    return handleError(error, 'Failed to retrieve enums');
  }
};

export const getWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<WorkspaceEnum> => {
  try {
    const row = await db.catalog.getEnum(workspace, id);
    httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
    return toApiEnum(row);
  } catch (error) {
    return handleError(error, 'Failed to retrieve enum');
  }
};

export const createWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateEnumRequest
): Promise<WorkspaceEnum> => {
  try {
    const timestamp = new Date();
    const row = await db.catalog.createEnum(buildCreateEnumInput(workspace, body, timestamp));
    return toApiEnum(row);
  } catch (error) {
    return handleError(error, 'Failed to create enum');
  }
};

export const updateWorkspaceEnum = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateEnumRequest
): Promise<WorkspaceEnum> => {
  try {
    const oldRow = await db.catalog.getEnum(workspace, id);
    httpAssert.present(oldRow, { status: 404, message: `Enum '${id}' not found` });

    const row = await db.catalog.updateEnum(
      workspace,
      id,
      buildUpdateEnumInput(body, oldRow, new Date())
    );
    httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
    return toApiEnum(row);
  } catch (error) {
    return handleError(error, 'Failed to update enum');
  }
};

export const deleteWorkspaceEnum = async (db: DatabaseAdapter, workspace: string, id: string) => {
  try {
    const schemas = await db.catalog.listSchemas(workspace);
    httpAssert.true(!isEnumReferencedBySchemas(schemas, id), {
      status: 409,
      message: 'Cannot delete enum: it is still referenced by one or more schema fields'
    });

    const row = await db.catalog.getEnum(workspace, id);
    httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });

    await db.catalog.deleteEnum(workspace, id);
    return { success: true, message: `Enum '${id}' deleted` };
  } catch (error) {
    return handleError(error, 'Failed to delete enum');
  }
};
