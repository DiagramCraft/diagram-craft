import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

const notificationChannelSchema = z.enum(['in_app', 'email', 'slack', 'sms']);

const notificationTypeSchema = z.enum([
  'entity-watch-activity',
  'governance-task-assigned',
  'governance-case-activity',
  'governance-proposal-reminder'
]);

const notificationTypeMetaSchema = z.object({
  notificationType: notificationTypeSchema,
  label: z.string().describe('Human-readable name of the notification type'),
  description: z.string().describe('What triggers this notification type'),
  category: z
    .enum(['normal', 'reminder'])
    .describe('Whether this is a normal notification type or a reminder')
});

const notificationChannelMetaSchema = z.object({
  channel: notificationChannelSchema,
  label: z.string().describe('Human-readable name of the delivery channel'),
  implemented: z.boolean().describe('Whether this channel can currently deliver notifications')
});

const notificationPreferenceEntrySchema = z.object({
  notificationType: notificationTypeSchema,
  channel: notificationChannelSchema,
  enabled: z.boolean().describe('Whether this channel is enabled for this notification type'),
  isDefault: z
    .boolean()
    .describe('True if this reflects the catalog default rather than an explicit override')
});

const notificationPreferencesResponseSchema = z.object({
  notificationTypes: z.array(notificationTypeMetaSchema),
  channels: z.array(notificationChannelMetaSchema),
  preferences: z.array(notificationPreferenceEntrySchema)
});

// ── Contract ──────────────────────────────────────────────────

export const notificationPreferencesContract = oc.tag('NotificationPreferences').router({
  notificationPreferences: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/notification-preferences',
        inputStructure: 'detailed',
        summary: 'Get notification delivery preferences',
        description:
          "Retrieves the notification-type and channel catalog along with the current user's effective delivery preferences for this workspace.",
        tags: ['NotificationPreferences']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(notificationPreferencesResponseSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/notification-preferences',
        inputStructure: 'detailed',
        summary: 'Update notification delivery preferences',
        description:
          "Sets the current user's delivery preference for one or more notification-type/channel pairs in this workspace. Only affects future notifications.",
        tags: ['NotificationPreferences']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            preferences: z.array(
              z.object({
                notificationType: notificationTypeSchema,
                channel: notificationChannelSchema,
                enabled: z.boolean()
              })
            )
          })
        })
      )
      .output(notificationPreferencesResponseSchema)
  }
});

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export type NotificationTypeMeta = z.infer<typeof notificationTypeMetaSchema>;

export type NotificationChannelMeta = z.infer<typeof notificationChannelMetaSchema>;

export type NotificationPreferenceEntry = z.infer<typeof notificationPreferenceEntrySchema>;

export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesResponseSchema>;
