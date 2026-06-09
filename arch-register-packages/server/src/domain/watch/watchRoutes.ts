import type { NotificationCount, NotificationItem, WatchedEntity } from '@arch-register/api-types';
import { H3, defineHandler, readBody } from 'h3';
import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import { Entity } from '../catalog/db/catalogDatabase';

const BASE = '/api/:workspace';
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

const toWatchedEntity = (entity: {
  id: string;
  name: string;
  slug: string;
  schema_id: string;
  created_at: Date;
}): WatchedEntity => ({
  entity_id: entity.id,
  entity_name: entity.name,
  entity_slug: entity.slug,
  schema_id: entity.schema_id,
  created_at: entity.created_at.toISOString()
});

const toNotificationItem = (notification: {
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
}): NotificationItem => ({
  id: notification.id,
  entity_id: notification.entity_id,
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

export const createWatchRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  router.get(
    `${BASE}/watching`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const userId = authEvent.context.user.id;
      const [watches, entities] = await Promise.all([
        db.watch.listWatches(userId, workspace),
        db.catalog.listEntities(workspace)
      ]);
      const entityMap = new Map(entities.map(entity => [entity.id, entity]));

      return watches
        .map(watch => {
          const entity = entityMap.get(watch.entity_id);
          if (!entity) return null;
          if (!checker.hasEntityPermission(authCtx, entity, 'view_entity')) return null;
          return {
            ...toWatchedEntity(entity),
            created_at: watch.created_at.toISOString()
          };
        })
        .filter((item): item is WatchedEntity => item != null);
    })
  );

  router.post(
    `${BASE}/watching`,
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
        'You do not have access to watch this entity'
      );

      const watch = await db.watch.createWatch({
        user_id: authEvent.context.user.id,
        workspace,
        entity_id: entityId,
        created_at: new Date()
      });

      return {
        ...toWatchedEntity(entity),
        created_at: watch.created_at.toISOString()
      };
    })
  );

  router.delete(
    `${BASE}/watching/:entityId`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const entityId = event.context.params?.['entityId'];
      httpAssert.string(entityId, { message: 'entityId is required' });

      await db.watch.deleteWatch(authEvent.context.user.id, workspace, entityId);

      return { success: true, message: `Entity '${entityId}' unwatched` };
    })
  );

  router.get(
    `${BASE}/notifications`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const userId = authEvent.context.user.id;
      const [notifications, entities] = await Promise.all([
        db.watch.listNotifications(userId, workspace),
        db.catalog.listEntities(workspace)
      ]);
      const entityMap = new Map(entities.map(entity => [entity.id, entity]));

      return notifications
        .filter(notification => canAccessNotification(authCtx, entityMap, notification))
        .map(toNotificationItem);
    })
  );

  router.get(
    `${BASE}/notifications/count`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const userId = authEvent.context.user.id;
      const [notifications, entities] = await Promise.all([
        db.watch.listNotifications(userId, workspace),
        db.catalog.listEntities(workspace)
      ]);
      const entityMap = new Map(entities.map(entity => [entity.id, entity]));

      const response: NotificationCount = {
        count: notifications.filter(notification =>
          canAccessNotification(authCtx, entityMap, notification)
        ).length
      };

      return response;
    })
  );

  router.delete(
    `${BASE}/notifications/:notificationId`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const notificationId = event.context.params?.['notificationId'];
      httpAssert.string(notificationId, { message: 'notificationId is required' });

      const deleted = await db.watch.deleteNotification(
        authEvent.context.user.id,
        workspace,
        notificationId
      );
      httpAssert.present(deleted, {
        status: 404,
        message: `Notification '${notificationId}' not found`
      });

      return { success: true, message: `Notification '${notificationId}' deleted` };
    })
  );

  router.delete(
    `${BASE}/notifications`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const deleted = await db.watch.clearNotifications(authEvent.context.user.id, workspace);
      return { success: true, count: deleted, message: 'Notifications cleared' };
    })
  );

  return router;
};
