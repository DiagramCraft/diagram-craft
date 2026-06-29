import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import type { Entity } from '../catalog/db/catalogDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import {
  NotificationCount,
  NotificationItem,
  WatchedEntity
} from '@arch-register/api-types/watchContract';

const checker = new PermissionChecker();

export const canAccessNotification = (
  authCtx: AuthorizationContext,
  entityMap: Map<string, Entity>,
  notification: { entity_id: string }
) => {
  const entity = entityMap.get(notification.entity_id);
  if (entity == null) return false;
  return checker.hasEntityPermission(authCtx, entity, 'view_entity');
};

const toWatchedEntity = (
  entity: {
    id: string;
    public_id?: string;
    name: string;
    slug: string;
    schema_id: string;
    created_at: Date;
  },
  watchCreatedAt: Date
): WatchedEntity => ({
  entity_id: entity.id,
  entity_public_id: entity.public_id ?? entity.id,
  entity_name: entity.name,
  entity_slug: entity.slug,
  schema_id: entity.schema_id,
  created_at: watchCreatedAt.toISOString()
});

const toNotificationItem = (
  notification: {
    id: string;
    entity_id: string;
    entity_name: string;
    entity_slug: string;
    schema_id: string | null;
    operation: 'create' | 'update' | 'delete';
    changed_by_user_id: string;
    changed_by_display_name: string;
    timestamp: Date;
    created_at: Date;
    audit_log_id: string;
  },
  entityPublicId: string
): NotificationItem => ({
  id: notification.id,
  entity_id: notification.entity_id,
  entity_public_id: entityPublicId,
  entity_name: notification.entity_name,
  entity_slug: notification.entity_slug,
  schema_id: notification.schema_id,
  operation: notification.operation,
  changed_by_user_id: notification.changed_by_user_id,
  changed_by_display_name: notification.changed_by_display_name,
  timestamp: notification.timestamp.toISOString(),
  created_at: notification.created_at.toISOString(),
  audit_log_id: notification.audit_log_id
});

export const listWatching = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<WatchedEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const [watches, entities] = await Promise.all([
    db.watch.listWatches(userId, ws),
    listAllCatalogEntities(db, ws)
  ]);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));

  return watches
    .map(watch => {
      const entity = entityMap.get(watch.entity_id);
      if (!entity) return null;
      if (!checker.hasEntityPermission(authCtx, entity, 'view_entity')) return null;
      return toWatchedEntity(entity, watch.created_at);
    })
    .filter((item): item is WatchedEntity => item != null);
};

export const createWatch = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<WatchedEntity> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(ws, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  requireEntityAction(
    authCtx,
    entity,
    'view_entity',
    'You do not have access to watch this entity'
  );

  const watch = await db.watch.createWatch({
    user_id: event.context.user.id,
    workspace: ws,
    entity_id: entity.id,
    created_at: new Date()
  });

  return toWatchedEntity(entity, watch.created_at);
};

export const deleteWatch = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(ws, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  await db.watch.deleteWatch(event.context.user.id, ws, entity.id);
  return { success: true, message: `Entity '${entityId}' unwatched` };
};

export const listNotifications = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<NotificationItem[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const [notifications, entities] = await Promise.all([
    db.watch.listNotifications(userId, ws),
    listAllCatalogEntities(db, ws)
  ]);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));

  return notifications
    .filter(notification => canAccessNotification(authCtx, entityMap, notification))
    .map(notification => {
      const entity = entityMap.get(notification.entity_id);
      return toNotificationItem(notification, entity?.public_id ?? notification.entity_id);
    });
};

export const getNotificationCount = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<NotificationCount> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const [notifications, entities] = await Promise.all([
    db.watch.listNotifications(userId, ws),
    listAllCatalogEntities(db, ws)
  ]);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));

  return {
    count: notifications.filter(notification =>
      canAccessNotification(authCtx, entityMap, notification)
    ).length
  };
};

export const deleteNotification = async (
  db: DatabaseAdapter,
  workspace: string,
  notificationId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const deleted = await db.watch.deleteNotification(event.context.user.id, ws, notificationId);
  httpAssert.present(deleted, {
    status: 404,
    message: `Notification '${notificationId}' not found`
  });

  return { success: true, message: `Notification '${notificationId}' deleted` };
};

export const clearNotifications = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const deleted = await db.watch.clearNotifications(event.context.user.id, ws);
  return { success: true, count: deleted, message: 'Notifications cleared' };
};
