import type { z } from 'zod';
import type { pinnedEntitySchema } from './viewContract.js';
import type {
  notificationCountSchema,
  notificationItemSchema,
  watchedEntitySchema
} from './watchContract.js';

export type WatchedEntity = z.infer<typeof watchedEntitySchema>;

export type PinnedEntity = z.infer<typeof pinnedEntitySchema>;

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export type NotificationCount = z.infer<typeof notificationCountSchema>;
