import { H3, defineHandler, readBody } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  SavedView as ApiSavedView
} from '@arch-register/api-types/views';
import type { PinnedEntity } from '@arch-register/api-types';
import type { Entity } from '../../types';
import { PermissionChecker } from '@arch-register/permissions';
import { SavedViewRow } from '@arch-register/server/domain/catalog/db/catalogDatabase';

const BASE = '/api/:workspace/views';
const PINNED_BASE = '/api/:workspace/pinned-entities';
const checker = new PermissionChecker();

const toApi = (view: SavedViewRow): ApiSavedView => ({
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

const toPinnedEntity = (entity: {
  id: string;
  name: string;
  slug: string;
  schema_id: string;
  created_at: Date;
}): PinnedEntity => ({
  entity_id: entity.id,
  entity_name: entity.name,
  entity_slug: entity.slug,
  schema_id: entity.schema_id,
  created_at: entity.created_at.toISOString()
});

const canAccessPinnedEntity = (
  authCtx: Awaited<ReturnType<typeof buildApiAuthCtx>>,
  entityMap: Map<string, Entity>,
  entityId: string
) => {
  const entity = entityMap.get(entityId);
  if (entity == null) return false;
  return checker.hasEntityPermission(authCtx, entity, 'view_entity');
};

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

  router.get(
    PINNED_BASE,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const userId = authEvent.context.user.id;
      const [pins, entities] = await Promise.all([
        db.catalog.listPinnedEntities(userId, workspace),
        db.catalog.listEntities(workspace)
      ]);
      const entityMap = new Map(entities.map(entity => [entity.id, entity]));

      return pins
        .map(pin => {
          const entity = entityMap.get(pin.entity_id);
          if (!entity) return null;
          if (!canAccessPinnedEntity(authCtx, entityMap, pin.entity_id)) return null;
          return {
            ...toPinnedEntity(entity),
            created_at: pin.created_at.toISOString()
          };
        })
        .filter((item): item is PinnedEntity => item != null);
    })
  );

  router.post(
    PINNED_BASE,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const body = await readBody(event).catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const entityId = (body as Record<string, unknown>)['entity_id'];
      httpAssert.string(entityId, { message: 'entity_id is required' });

      const entity = await db.catalog.getEntity(workspace, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to pin this entity'
      );

      const pin = await db.catalog.createPinnedEntity({
        user_id: authEvent.context.user.id,
        workspace,
        entity_id: entityId,
        created_at: new Date()
      });

      return {
        ...toPinnedEntity(entity),
        created_at: pin.created_at.toISOString()
      };
    })
  );

  router.delete(
    `${PINNED_BASE}/:entityId`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const entityId = event.context.params?.['entityId'];
      httpAssert.string(entityId, { message: 'entityId is required' });

      await db.catalog.deletePinnedEntity(authEvent.context.user.id, workspace, entityId);

      return { success: true, message: `Entity '${entityId}' unpinned` };
    })
  );

  return router;
}
