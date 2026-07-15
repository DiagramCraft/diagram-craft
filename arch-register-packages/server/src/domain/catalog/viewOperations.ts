import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  SavedView as ApiSavedView
} from '@arch-register/api-types/viewContract';
import { PermissionChecker } from '@arch-register/permissions';
import type { Entity, SavedViewDbResult } from './db/catalogDatabase';
import { PinnedEntity } from '@arch-register/api-types/watchContract';
import { listAllCatalogEntities } from './entityLoader';

const checker = new PermissionChecker();

export const toApi = (view: SavedViewDbResult): ApiSavedView => ({
  id: view.id,
  workspaceId: view.workspace,
  scope: view.project_id == null ? 'workspace' : 'project',
  projectId: view.project_id,
  projectScope: view.project_scope,
  name: view.name,
  description: view.description,
  isAdminView: view.is_admin_view,
  viewMode: view.view_mode,
  filters: view.filters,
  config: view.config,
  createdAt: view.created_at.toISOString(),
  updatedAt: view.updated_at.toISOString()
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

export const listSavedViews = async (
  db: DatabaseAdapter,
  workspace: string,
  options?: {
    projectId?: string | null;
    includeWorkspace?: boolean;
  }
): Promise<ApiSavedView[]> => {
  const views = await db.view.listSavedViews(workspace, options);
  return views.map(toApi);
};

export const createSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateSavedViewRequest
): Promise<ApiSavedView> => {
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });
  httpAssert.true(body.viewMode, { status: 400, message: 'viewMode is required' });
  httpAssert.true(body.filters, { status: 400, message: 'filters is required' });
  const scope = body.scope ?? 'workspace';
  const projectId = scope === 'project' ? (body.projectId ?? null) : null;

  httpAssert.true(scope === 'workspace' || projectId != null, {
    status: 400,
    message: 'projectId is required for project-scoped views'
  });

  const now = new Date();
  const view = await db.view.createSavedView({
    id: randomUUID(),
    workspace,
    project_id: projectId,
    project_scope: body.projectScope ?? null,
    name: body.name,
    description: body.description ?? null,
    is_admin_view: body.isAdminView ?? false,
    view_mode: body.viewMode,
    filters: body.filters,
    config: body.config ?? null,
    created_at: now,
    updated_at: now
  });

  return toApi(view);
};

export const updateSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateSavedViewRequest
): Promise<ApiSavedView> => {
  httpAssert.true(id, { status: 400, message: 'ID is required' });

  const existing = await db.view.getSavedView(workspace, id);
  httpAssert.true(existing, { status: 404, message: 'View not found' });

  const updated = await db.view.updateSavedView(workspace, id, {
    name: body.name,
    description: body.description,
    is_admin_view: body.isAdminView,
    view_mode: body.viewMode,
    filters: body.filters,
    config: body.config,
    project_scope: body.projectScope,
    updated_at: new Date()
  });

  httpAssert.true(updated, { status: 404, message: 'View not found' });
  return toApi(updated!);
};

export const deleteSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<{ success: boolean }> => {
  httpAssert.true(id, { status: 400, message: 'ID is required' });

  const deleted = await db.view.deleteSavedView(workspace, id);
  httpAssert.true(deleted, { status: 404, message: 'View not found' });

  return { success: true };
};

export const listPinnedEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<PinnedEntity[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const [pins, entities] = await Promise.all([
    db.catalog.listPinnedEntities(userId, workspace),
    listAllCatalogEntities(db, workspace)
  ]);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));

  return pins
    .map(pin => {
      const entity = entityMap.get(pin.entity_id);
      if (!entity) return null;
      if (!canAccessPinnedEntity(authCtx, entityMap, pin.entity_id)) return null;
      return {
        entity_id: entity.id,
        entity_public_id: entity.public_id ?? entity.id,
        entity_name: entity.name,
        entity_slug: entity.slug,
        schema_id: entity.schema_id,
        created_at: pin.created_at.toISOString()
      };
    })
    .filter((item): item is PinnedEntity => item != null);
};

export const createPinnedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<PinnedEntity> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  requireEntityAction(authCtx, entity, 'view_entity', 'You do not have access to pin this entity');

  const pin = await db.catalog.createPinnedEntity({
    user_id: event.context.user.id,
    workspace,
    entity_id: entity.id,
    created_at: new Date()
  });

  return {
    entity_id: entity.id,
    entity_public_id: entity.public_id ?? entity.id,
    entity_name: entity.name,
    entity_slug: entity.slug,
    schema_id: entity.schema_id,
    created_at: pin.created_at.toISOString()
  };
};

export const deletePinnedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  await db.catalog.deletePinnedEntity(event.context.user.id, workspace, entity.id);

  return { success: true, message: `Entity '${entityId}' unpinned` };
};
