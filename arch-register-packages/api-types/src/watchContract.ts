import { oc } from '@orpc/contract';
import { z } from 'zod';
import { pinnedEntitySchema } from '@arch-register/api-types/viewContract';
import { ws, wsAndId } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

const watchedEntitySchema = z.object({
  entity_id: z.string(),
  entity_public_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  schema_id: z.string(),
  created_at: z.string()
});

const notificationItemSchema = z.object({
  id: z.string(),
  entity_id: z.string(),
  entity_public_id: z.string(),
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

const notificationCountSchema = z.object({
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

// ── Contract ──────────────────────────────────────────────────

export const watchContract = {
  watching: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/watching', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(watchedEntitySchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/watching', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            entity_id: z.string()
          })
        })
      )
      .output(watchedEntitySchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/watching/{id}',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(successResponseSchema)
  },
  notifications: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/notifications', inputStructure: 'detailed' })
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
        inputStructure: 'detailed'
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
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(successResponseSchema),
    clear: oc
      .route({ method: 'DELETE', path: '/{workspace}/notifications', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(clearResponseSchema)
  }
};

export type WatchedEntity = z.infer<typeof watchedEntitySchema>;

export type PinnedEntity = z.infer<typeof pinnedEntitySchema>;

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export type NotificationCount = z.infer<typeof notificationCountSchema>;
