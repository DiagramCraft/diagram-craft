import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { getWorkspaceAnalytics } from './workspaceAnalyticsOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const analyticsRouter = implement(workspaceAnalyticsContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceAnalyticsORPCRouter = analyticsRouter.router({
  analytics: {
    get: analyticsRouter.analytics.get.handler(async ({ input, context }) => {
      return await getWorkspaceAnalytics(
        context.db,
        input.params.workspace,
        context.event,
        input.query.staleAfterDays
      );
    })
  }
});

export const workspaceAnalyticsOpenAPIHandler = new OpenAPIHandler(workspaceAnalyticsORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceAnalyticsORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceAnalyticsOpenAPIHandler.handle(event.req, {
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
