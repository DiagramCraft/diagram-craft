import { defineHandler } from 'h3';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { implement } from '@orpc/server';
import { webhookContract } from '@arch-register/api-types/webhookContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  rotateWebhookSecret,
  updateWebhook
} from './webhookOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(webhookContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const webhookORPCRouter = router.router({
  webhooks: {
    list: router.webhooks.list.handler(({ input, context }) =>
      listWebhooks(context.db, input.params.workspace, context.event)
    ),
    create: router.webhooks.create.handler(({ input, context }) =>
      createWebhook(context.db, input.params.workspace, input.body, context.event)
    ),
    update: router.webhooks.update.handler(({ input, context }) =>
      updateWebhook(context.db, input.params.workspace, input.params.id, input.body, context.event)
    ),
    remove: router.webhooks.remove.handler(({ input, context }) =>
      deleteWebhook(context.db, input.params.workspace, input.params.id, context.event)
    ),
    rotateSecret: router.webhooks.rotateSecret.handler(({ input, context }) =>
      rotateWebhookSecret(context.db, input.params.workspace, input.params.id, context.event)
    )
  }
});

const handler = new OpenAPIHandler(webhookORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWebhookORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await handler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
