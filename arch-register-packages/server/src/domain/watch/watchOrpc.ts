import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
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

const watchRouter = implement(watchContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const watchORPCRouter = watchRouter.router({
  watching: {
    list: watchRouter.watching.list.handler(async ({ input, context }) => {
      return await listWatching(context.db, input.params.workspace, context.event);
    }),
    create: watchRouter.watching.create.handler(async ({ input, context }) => {
      return await createWatch(
        context.db,
        input.params.workspace,
        input.body.entity_id,
        context.event
      );
    }),
    remove: watchRouter.watching.remove.handler(async ({ input, context }) => {
      return await deleteWatch(context.db, input.params.workspace, input.params.id, context.event);
    })
  },
  notifications: {
    list: watchRouter.notifications.list.handler(async ({ input, context }) => {
      return await listNotifications(context.db, input.params.workspace, context.event);
    }),
    count: watchRouter.notifications.count.handler(async ({ input, context }) => {
      return await getNotificationCount(context.db, input.params.workspace, context.event);
    }),
    clear: watchRouter.notifications.clear.handler(async ({ input, context }) => {
      return await clearNotifications(context.db, input.params.workspace, context.event);
    }),
    remove: watchRouter.notifications.remove.handler(async ({ input, context }) => {
      return await deleteNotification(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
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
