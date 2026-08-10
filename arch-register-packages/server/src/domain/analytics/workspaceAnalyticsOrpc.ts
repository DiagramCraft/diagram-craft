import { implement } from '@orpc/server';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
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

export const createWorkspaceAnalyticsORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceAnalyticsORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
