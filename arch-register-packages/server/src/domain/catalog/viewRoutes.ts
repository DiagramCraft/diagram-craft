import { H3, defineHandler, readBody } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import {
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  listPinnedEntities,
  createPinnedEntity,
  deletePinnedEntity
} from './viewOperations';

const BASE = '/api/:workspace/views';
const PINNED_BASE = '/api/:workspace/pinned-entities';

export function createViewRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await listSavedViews(db, workspace);
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');
      const body = (await readBody(event)) as CreateSavedViewRequest;
      return await createSavedView(db, workspace, body);
    })
  );

  router.patch(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');
      const id = event.context.params?.['id'] ?? '';
      const body = (await readBody(event)) as UpdateSavedViewRequest;
      return await updateSavedView(db, workspace, id, body);
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.manage_views');
      const id = event.context.params?.['id'] ?? '';
      return await deleteSavedView(db, workspace, id);
    })
  );

  router.get(
    PINNED_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listPinnedEntities(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.post(
    PINNED_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await readBody(event).catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const entityId = (body as Record<string, unknown>)['entity_id'];
      httpAssert.string(entityId, { message: 'entity_id is required' });
      return await createPinnedEntity(db, workspace, entityId, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${PINNED_BASE}/:entityId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const entityId = event.context.params?.['entityId'];
      httpAssert.string(entityId, { message: 'entityId is required' });
      return await deletePinnedEntity(db, workspace, entityId, event as AuthenticatedEvent);
    })
  );

  return router;
}
