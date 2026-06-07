import { H3, defineHandler, readBody } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../db/database';
import { resolveWorkspace } from '../api-helpers/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../middleware/auth';
import { httpAssert } from '../utils/httpAssert';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  SavedView as ApiSavedView
} from '@arch-register/api-types/views';
import type { SavedView } from '../types';

const BASE = '/api/:workspace/views';

const toApi = (view: SavedView): ApiSavedView => ({
  id: view.id,
  workspaceId: view.workspace,
  name: view.name,
  description: view.description,
  viewMode: view.view_mode,
  filters: view.filters,
  config: view.config,
  createdAt: view.created_at.toISOString(),
  updatedAt: view.updated_at.toISOString()
});

export function createViewRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const views = await db.view.listSavedViews(workspace);
      return views.map(toApi);
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');

      const body = (await readBody(event)) as CreateSavedViewRequest;
      httpAssert.true(body.name, { status: 400, message: 'Name is required' });
      httpAssert.true(body.viewMode, { status: 400, message: 'viewMode is required' });
      httpAssert.true(body.filters, { status: 400, message: 'filters is required' });

      const now = new Date();
      const view = await db.view.createSavedView({
        id: randomUUID(),
        workspace,
        name: body.name,
        description: body.description ?? null,
        view_mode: body.viewMode,
        filters: body.filters,
        config: body.config ?? null,
        created_at: now,
        updated_at: now
      });

      return toApi(view);
    })
  );

  router.patch(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');

      const id = event.context.params?.['id'] ?? '';
      httpAssert.true(id, { status: 400, message: 'ID is required' });

      const body = (await readBody(event)) as UpdateSavedViewRequest;
      const updated = await db.view.updateSavedView(workspace, id, {
        name: body.name,
        description: body.description,
        view_mode: body.viewMode,
        filters: body.filters,
        config: body.config,
        updated_at: new Date()
      });

      httpAssert.true(updated, { status: 404, message: 'View not found' });
      return toApi(updated!);
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');

      const id = event.context.params?.['id'] ?? '';
      httpAssert.true(id, { status: 400, message: 'ID is required' });

      const deleted = await db.view.deleteSavedView(workspace, id);
      httpAssert.true(deleted, { status: 404, message: 'View not found' });

      return { success: true };
    })
  );

  return router;
}
