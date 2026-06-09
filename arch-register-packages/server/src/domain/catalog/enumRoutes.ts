import { H3, defineHandler } from 'h3';
import { newid } from '@diagram-craft/utils/id';
import type {
  DatabaseAdapter,
  WorkspaceEnumDbCreate,
  WorkspaceEnumDbUpdate
} from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { handleDbError } from '../../utils/http';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { toApiEnum } from './schemaHelpers';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';

const BASE = '/api/:workspace/enums';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'An enum with that name already exists in this workspace',
    foreign: 'Cannot delete enum: it is still referenced by a schema field'
  });

type EnumOption = WorkspaceEnumDbResult['options'][number];

const toEnumOptions = (value: unknown, fallback: EnumOption[]) =>
  Array.isArray(value) ? (value as EnumOption[]) : fallback;

const toSortOrder = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

export const buildCreateEnumInput = (
  workspace: string,
  body: Record<string, unknown>,
  timestamp: Date
): WorkspaceEnumDbCreate => {
  const { name, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: newid(),
    workspace,
    name,
    options: toEnumOptions(options, []),
    sort_order: toSortOrder(sort_order, 0),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateEnumInput = (
  body: Record<string, unknown>,
  existing: WorkspaceEnumDbResult,
  updatedAt: Date
): WorkspaceEnumDbUpdate => {
  const { name, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    options: toEnumOptions(options, existing.options),
    sort_order: toSortOrder(sort_order, existing.sort_order),
    updated_at: updatedAt
  };
};

export const isEnumReferencedBySchemas = (schemas: SchemaDbResult[], enumId: string) =>
  schemas.some(schema => schema.fields.some(f => f.type === 'select' && f.enumId === enumId));

export function createEnumRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      try {
        const enums = await db.catalog.listEnums(workspace);
        return enums.map(toApiEnum);
      } catch (e) {
        handleError(e, 'Failed to retrieve enums');
      }
    })
  );

  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      try {
        const row = await db.catalog.getEnum(workspace, id);
        httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
        return toApiEnum(row);
      } catch (e) {
        handleError(e, 'Failed to retrieve enum');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      try {
        const timestamp = new Date();
        const row = await db.catalog.createEnum(
          buildCreateEnumInput(workspace, body as Record<string, unknown>, timestamp)
        );
        return toApiEnum(row);
      } catch (e) {
        handleError(e, 'Failed to create enum');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      try {
        const oldRow = await db.catalog.getEnum(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Enum '${id}' not found` });

        const row = await db.catalog.updateEnum(
          workspace,
          id,
          buildUpdateEnumInput(body as Record<string, unknown>, oldRow, new Date())
        );
        httpAssert.present(row, { status: 404, message: `Enum '${id}' not found` });
        return toApiEnum(row);
      } catch (e) {
        handleError(e, 'Failed to update enum');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
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
      } catch (e) {
        handleError(e, 'Failed to delete enum');
      }
    })
  );

  return router;
}
