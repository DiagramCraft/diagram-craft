import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { getNotificationPreferences, updateNotificationPreferences } from './notificationPreferenceOperations';
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

export const notificationPreferencesOpenAPIHandler = new OpenAPIHandler(
  notificationPreferencesORPCRouter,
  { clientInterceptors: orpcErrorInterceptors }
);

export const createNotificationPreferencesORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await notificationPreferencesOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
