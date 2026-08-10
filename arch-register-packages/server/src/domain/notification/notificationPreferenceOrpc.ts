import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from './notificationPreferenceOperations';
import { notificationPreferencesContract } from '@arch-register/api-types/notificationPreferencesContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const notificationPreferencesRouter = implement(notificationPreferencesContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const notificationPreferencesORPCRouter = notificationPreferencesRouter.router({
  notificationPreferences: {
    get: notificationPreferencesRouter.notificationPreferences.get.handler(
      async ({ input, context }) => {
        return await getNotificationPreferences(context.db, input.params.workspace, context.event);
      }
    ),
    update: notificationPreferencesRouter.notificationPreferences.update.handler(
      async ({ input, context }) => {
        return await updateNotificationPreferences(
          context.db,
          input.params.workspace,
          context.event,
          input.body.preferences
        );
      }
    )
  }
});

export const createNotificationPreferencesORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(notificationPreferencesORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
