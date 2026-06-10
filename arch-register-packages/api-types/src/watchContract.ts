import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

export const watchedEntitySchema = z.object({
  entity_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  schema_id: z.string(),
  created_at: z.string()
});

export const notificationItemSchema = z.object({
  id: z.string(),
  entity_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  schema_id: z.string().nullable(),
  operation: z.enum(['create', 'update', 'delete']),
  changed_by_user_id: z.string(),
  changed_by_display_name: z.string(),
  timestamp: z.string(),
  created_at: z.string(),
  audit_log_id: z.string()
});

export const notificationCountSchema = z.object({
  count: z.number()
});

const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

const clearResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  message: z.string()
});

// ── Request schemas ───────────────────────────────────────────

export const listWatchingRequestSchema = z.object({
  workspace: z.string()
});

export const createWatchRequestSchema = z.object({
  workspace: z.string(),
  entity_id: z.string()
});

export const deleteWatchRequestSchema = z.object({
  workspace: z.string(),
  entityId: z.string()
});

export const listNotificationsRequestSchema = z.object({
  workspace: z.string()
});

export const getNotificationCountRequestSchema = z.object({
  workspace: z.string()
});

export const deleteNotificationRequestSchema = z.object({
  workspace: z.string(),
  notificationId: z.string()
});

export const clearNotificationsRequestSchema = z.object({
  workspace: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const watchContract = {
  watching: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/watching' })
      .input(listWatchingRequestSchema)
      .output(z.array(watchedEntitySchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/watching' })
      .input(createWatchRequestSchema)
      .output(watchedEntitySchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/watching/{entityId}' })
      .input(deleteWatchRequestSchema)
      .output(successResponseSchema)
  },
  notifications: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/notifications' })
      .input(listNotificationsRequestSchema)
      .output(z.array(notificationItemSchema)),
    count: oc
      .route({ method: 'GET', path: '/{workspace}/notifications/count' })
      .input(getNotificationCountRequestSchema)
      .output(notificationCountSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/notifications/{notificationId}' })
      .input(deleteNotificationRequestSchema)
      .output(successResponseSchema),
    clear: oc
      .route({ method: 'DELETE', path: '/{workspace}/notifications' })
      .input(clearNotificationsRequestSchema)
      .output(clearResponseSchema)
  }
};
