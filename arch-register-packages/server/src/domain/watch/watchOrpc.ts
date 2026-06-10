import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  listWatching,
  createWatch,
  deleteWatch,
  listNotifications,
  getNotificationCount,
  deleteNotification,
  clearNotifications
} from './watchOperations';
import { watchContract } from '@arch-register/api-types/watchContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const watchRouter = implement(watchContract).$context<ORPCContext>();

export const watchORPCRouter = watchRouter.router({
  watching: {
    list: watchRouter.watching.list.handler(async ({ input, context }) => {
      try {
        return await listWatching(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: watchRouter.watching.create.handler(async ({ input, context }) => {
      try {
        return await createWatch(context.db, input.workspace, input.entity_id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: watchRouter.watching.remove.handler(async ({ input, context }) => {
      try {
        return await deleteWatch(context.db, input.workspace, input.entityId, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  },
  notifications: {
    list: watchRouter.notifications.list.handler(async ({ input, context }) => {
      try {
        return await listNotifications(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    count: watchRouter.notifications.count.handler(async ({ input, context }) => {
      try {
        return await getNotificationCount(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: watchRouter.notifications.remove.handler(async ({ input, context }) => {
      try {
        return await deleteNotification(
          context.db,
          input.workspace,
          input.notificationId,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    clear: watchRouter.notifications.clear.handler(async ({ input, context }) => {
      try {
        return await clearNotifications(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const watchOpenAPIHandler = new OpenAPIHandler(watchORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWatchORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await watchOpenAPIHandler.handle(event.req, {
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
