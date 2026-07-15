import { oc } from '@orpc/contract';
import { z } from 'zod';
import { pinnedEntitySchema } from '@arch-register/api-types/viewContract';
import { ws, wsAndId, wsAndUUID } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

const watchedEntitySchema = z.object({
  entity_id: z.string().describe('Entity identifier'),
  entity_public_id: z.string().describe('Public entity identifier'),
  entity_name: z.string().describe('Entity name'),
  entity_slug: z.string().describe('Entity URL slug'),
  schema_id: z.string().describe('Schema identifier'),
  created_at: z.string().describe('ISO 8601 timestamp when watch was created')
});

const notificationItemSchema = z.object({
  id: z.string().describe('Unique notification identifier'),
  entity_id: z.string().describe('Entity identifier'),
  entity_public_id: z.string().describe('Public entity identifier'),
  entity_name: z.string().describe('Entity name'),
  entity_slug: z.string().describe('Entity URL slug'),
  schema_id: z.string().nullable().describe('Schema identifier (may be null)'),
  operation: z
    .enum(['create', 'update', 'delete'])
    .describe('Type of operation that triggered the notification'),
  changed_by_user_id: z.string().describe('User who made the change'),
  changed_by_display_name: z.string().describe('Display name of user who made the change'),
  timestamp: z.string().describe('ISO 8601 timestamp of the change'),
  created_at: z.string().describe('ISO 8601 timestamp when notification was created'),
  audit_log_id: z.string().describe('Reference to audit log entry')
});

const notificationCountSchema = z.object({
  count: z.number().describe('Number of unread notifications')
});

const successResponseSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful'),
  message: z.string().describe('Status message')
});

const clearResponseSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful'),
  count: z.number().describe('Number of notifications cleared'),
  message: z.string().describe('Status message')
});

// ── Contract ──────────────────────────────────────────────────

export const watchContract = oc.tag('Watch').router({
  watching: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/watching',
        inputStructure: 'detailed',
        summary: 'List watched entities',
        description:
          'Retrieves all entities the current user is watching. Watched entities generate notifications when they are modified.',
        tags: ['Watch']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(watchedEntitySchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/watching',
        inputStructure: 'detailed',
        summary: 'Watch an entity',
        description:
          "Adds an entity to the current user's watch list. The user will receive notifications when the entity is modified.",
        tags: ['Watch']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            entity_id: z.string().describe('Entity identifier to watch')
          })
        })
      )
      .output(watchedEntitySchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/watching/{id}',
        inputStructure: 'detailed',
        summary: 'Unwatch an entity',
        description:
          "Removes an entity from the current user's watch list. The user will no longer receive notifications for this entity.",
        tags: ['Watch']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(successResponseSchema)
  },
  notifications: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/notifications',
        inputStructure: 'detailed',
        summary: 'List notifications',
        description:
          'Retrieves all notifications for the current user, including changes to watched entities and other relevant updates.',
        tags: ['Watch']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(notificationItemSchema)),
    count: oc
      .route({
        method: 'GET',
        path: '/{workspace}/notifications/count',
        inputStructure: 'detailed',
        summary: 'Get notification count',
        description: 'Retrieves the count of unread notifications for the current user.',
        tags: ['Watch']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(notificationCountSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/notifications/{id}',
        inputStructure: 'detailed',
        summary: 'Dismiss notification',
        description:
          'Marks a specific notification as read and removes it from the notification list.',
        tags: ['Watch']
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(successResponseSchema),
    clear: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/notifications',
        inputStructure: 'detailed',
        summary: 'Clear all notifications',
        description:
          'Marks all notifications as read and clears the notification list for the current user.',
        tags: ['Watch']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(clearResponseSchema)
  }
});

export type WatchedEntity = z.infer<typeof watchedEntitySchema>;

export type PinnedEntity = z.infer<typeof pinnedEntitySchema>;

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export type NotificationCount = z.infer<typeof notificationCountSchema>;
