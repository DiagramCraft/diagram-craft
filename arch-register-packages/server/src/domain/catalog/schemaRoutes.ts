import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import {
  listWorkspaceSchemas,
  getWorkspaceSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema
} from './schemaOperations';

const BASE = '/api/:workspace/schemas';

export function createSchemaRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return listWorkspaceSchemas(db, workspace);
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
      return getWorkspaceSchema(db, workspace, id);
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
      return createWorkspaceSchema(db, workspace, body as Record<string, unknown>, authCtx.userId);
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
      return updateWorkspaceSchema(
        db,
        workspace,
        id,
        body as Record<string, unknown>,
        authCtx.userId
      );
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
      return deleteWorkspaceSchema(db, workspace, id, authCtx.userId);
    })
  );

  return router;
}
