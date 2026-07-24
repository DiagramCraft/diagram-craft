import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  buildApiEntityAuthCtx,
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
import { isGovernanceCaseVisible } from '../governance/governanceOperations';
import { createGovernanceRegistry } from '../governance/governanceRegistry';
import type { InboxNotificationDbResult } from '../notification/db/notificationDatabase';
import {
  canAccessCommentNotification,
  isCommentNotification
} from '../notification/commentNotifications';

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

const isEntityNotification = (notification: InboxNotificationDbResult) =>
  notification.resource_type === 'entity' && notification.case_id == null;

const toNotificationItem = (
  notification: InboxNotificationDbResult,
  entityMap: Map<string, Entity>
): NotificationItem => {
  if (isEntityNotification(notification)) {
    const entity = entityMap.get(notification.resource_id);
    const operation = notification.event_type.replace('entity.', '') as
      | 'create'
      | 'update'
      | 'delete';
    return {
      id: notification.id,
      category: notification.category,
      event_type: notification.event_type,
      resource_type: notification.resource_type,
      resource_id: notification.resource_id,
      case_id: notification.case_id,
      assignment_id: notification.assignment_id,
      title: notification.title,
      message: notification.message,
      action_route: notification.action_route,
      read_at: notification.read_at?.toISOString() ?? null,
      entity_id: notification.resource_id,
      entity_public_id: entity?.public_id ?? notification.resource_id,
      entity_name: notification.title,
      entity_slug: String(
        notification.presentation_metadata.entitySlug ?? notification.resource_id
      ),
      schema_id: (notification.presentation_metadata.schemaId as string | null) ?? null,
      operation,
      changed_by_user_id: notification.actor_user_id ?? '',
      changed_by_display_name: notification.actor_display_name ?? 'System',
      timestamp: notification.occurred_at.toISOString(),
      created_at: notification.created_at.toISOString(),
      audit_log_id: notification.id
    };
  }

  if (isCommentNotification(notification)) {
    return {
      id: notification.id,
      category: notification.category,
      event_type: notification.event_type,
      resource_type: notification.resource_type,
      resource_id: notification.resource_id,
      case_id: notification.case_id,
      assignment_id: notification.assignment_id,
      title: notification.title,
      message: notification.message,
      action_route: notification.action_route,
      read_at: notification.read_at?.toISOString() ?? null,
      entity_id: null,
      entity_public_id: null,
      entity_name: null,
      entity_slug: null,
      schema_id: null,
      operation: null,
      changed_by_user_id: notification.actor_user_id,
      changed_by_display_name: notification.actor_display_name,
      timestamp: notification.occurred_at.toISOString(),
      created_at: notification.created_at.toISOString(),
      audit_log_id: null
    };
  }

  return {
    id: notification.id,
    category: notification.category,
    event_type: notification.event_type,
    resource_type: notification.resource_type,
    resource_id: notification.resource_id,
    case_id: notification.case_id,
    assignment_id: notification.assignment_id,
    title: notification.title,
    message: notification.message,
    action_route: notification.action_route,
    read_at: notification.read_at?.toISOString() ?? null,
    entity_id: notification.resource_id,
    entity_public_id: notification.resource_id,
    entity_name: notification.title,
    entity_slug: notification.resource_id,
    schema_id: null,
    operation: 'update',
    changed_by_user_id: notification.actor_user_id ?? '',
    changed_by_display_name: notification.actor_display_name ?? 'System',
    timestamp: notification.occurred_at.toISOString(),
    created_at: notification.created_at.toISOString(),
    audit_log_id: notification.case_id ?? notification.id
  };
};

const listVisibleNotifications = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  userId: string,
  entityMap: Map<string, Entity>
) => {
  const notifications = await db.notification.listNotifications(userId, workspace);
  const registry = createGovernanceRegistry();
  const visible = await Promise.all(
    notifications.map(async notification => {
      if (isEntityNotification(notification)) {
        return canAccessNotification(authCtx, entityMap, { entity_id: notification.resource_id })
          ? notification
          : null;
      }
      if (isCommentNotification(notification)) {
        return (await canAccessCommentNotification(
          db,
          workspace,
          authCtx,
          notification.presentation_metadata,
          entityMap
        ))
          ? notification
          : null;
      }
      if (!notification.case_id) return notification;
      const caseRow = await db.governance.getCase(workspace, notification.case_id);
      if (!caseRow) return null;
      const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
      return (await isGovernanceCaseVisible(db, authCtx, userId, caseRow, assignments, registry))
        ? notification
        : null;
    })
  );
  return visible.filter((item): item is InboxNotificationDbResult => item != null);
};

export const listWatching = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<WatchedEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
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
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
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
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
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
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const entities = await listAllCatalogEntities(db, ws);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  const notifications = await listVisibleNotifications(db, ws, authCtx, userId, entityMap);

  // The bell is an unread inbox, not a history log: once a notification is read (including
  // automatically, when its underlying action item is resolved) it drops out of view here even
  // though the row is retained in the database.
  return notifications
    .filter(notification => notification.read_at == null)
    .map(notification => toNotificationItem(notification, entityMap))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
};

export const getNotificationCount = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<NotificationCount> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const entities = await listAllCatalogEntities(db, ws);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  const notifications = await listVisibleNotifications(db, ws, authCtx, userId, entityMap);

  return { count: notifications.filter(notification => notification.read_at == null).length };
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

  const markedRead = await db.notification.markRead(
    event.context.user.id,
    ws,
    notificationId,
    new Date()
  );
  httpAssert.true(markedRead, {
    status: 404,
    message: `Notification '${notificationId}' not found`
  });

  return { success: true, message: `Notification '${notificationId}' marked as read` };
};

export const clearNotifications = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const markedRead = await db.notification.markAllRead(event.context.user.id, ws, new Date());
  return { success: true, count: markedRead, message: 'Notifications marked as read' };
};
