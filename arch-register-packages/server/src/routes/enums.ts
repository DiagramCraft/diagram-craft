import { H3, defineHandler } from 'h3';
import { newid } from '@diagram-craft/utils/id';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handleDbError } from '../utils/http.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { toApiEnum } from '../api/transforms.js';

const BASE = '/api/:workspace/enums';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'An enum with that name already exists in this workspace',
    foreign: 'Cannot delete enum: it is still referenced by a schema field'
  });

export function createEnumRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
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
      const workspace = await resolveWorkspace(event, db);
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, options = [], sort_order = 0 } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      try {
        const timestamp = new Date();
        const row = await db.catalog.createEnum({
          id: newid(),
          workspace,
          name: name as string,
          options: Array.isArray(options) ? (options as Array<{ value: string; label: string }>) : [],
          sort_order: typeof sort_order === 'number' ? sort_order : 0,
          created_at: timestamp,
          updated_at: timestamp
        });
        return toApiEnum(row);
      } catch (e) {
        handleError(e, 'Failed to create enum');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, options, sort_order } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      try {
        const oldRow = await db.catalog.getEnum(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Enum '${id}' not found` });

        const row = await db.catalog.updateEnum(workspace, id, {
          name: name as string,
          options: options !== undefined && Array.isArray(options)
            ? (options as Array<{ value: string; label: string }>)
            : oldRow.options,
          sort_order: typeof sort_order === 'number' ? sort_order : oldRow.sort_order,
          updated_at: new Date()
        });
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      try {
        // Guard: reject if any schema field still references this enum
        const schemas = await db.catalog.listSchemas(workspace);
        const referenced = schemas.some(schema =>
          schema.fields.some(f => f.type === 'select' && f.enumId === id)
        );
        httpAssert.true(!referenced, {
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
