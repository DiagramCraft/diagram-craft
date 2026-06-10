import { H3, defineHandler, readBody } from 'h3';
import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import type { Entity } from '../catalog/db/catalogDatabase';
import {
  listWatching,
  createWatch,
  deleteWatch,
  listNotifications,
  getNotificationCount,
  deleteNotification,
  clearNotifications
} from './watchOperations';

const BASE = '/api/:workspace';
const checker = new PermissionChecker();

// Kept exported for watchRoutes.test.ts
export const canAccessNotification = (
  authCtx: AuthorizationContext,
  entityMap: Map<string, Entity>,
  notification: { entity_id: string }
) => {
  const entity = entityMap.get(notification.entity_id);
  if (entity == null) return false;
  return checker.hasEntityPermission(authCtx, entity, 'view_entity');
};

export const createWatchRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  router.get(
    `${BASE}/watching`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      return await listWatching(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.post(
    `${BASE}/watching`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      const body = await readBody(event).catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const entityId = (body as Record<string, unknown>)['entity_id'];
      httpAssert.string(entityId, { message: 'entity_id is required' });
      return await createWatch(db, workspace, entityId, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${BASE}/watching/:entityId`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      const entityId = event.context.params?.['entityId'];
      httpAssert.string(entityId, { message: 'entityId is required' });
      return await deleteWatch(db, workspace, entityId, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/notifications`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      return await listNotifications(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/notifications/count`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      return await getNotificationCount(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${BASE}/notifications/:notificationId`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      const notificationId = event.context.params?.['notificationId'];
      httpAssert.string(notificationId, { message: 'notificationId is required' });
      return await deleteNotification(db, workspace, notificationId, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${BASE}/notifications`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      return await clearNotifications(db, workspace, event as AuthenticatedEvent);
    })
  );

  return router;
};
