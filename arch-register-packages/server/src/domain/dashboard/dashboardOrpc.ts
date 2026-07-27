import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { getWorkspaceDashboard, putWorkspaceDashboard } from './dashboardOperations';
import { workspaceDashboardContract } from '@arch-register/api-types/dashboardContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const dashboardRouter = implement(workspaceDashboardContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const workspaceDashboardORPCRouter = dashboardRouter.router({
  dashboard: {
    get: dashboardRouter.dashboard.get.handler(async ({ context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await getWorkspaceDashboard(context.db, workspace);
    }),
    put: dashboardRouter.dashboard.put.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await putWorkspaceDashboard(
        context.db,
        workspace,
        input.body.widgets,
        context.event.context.user.id
      );
    })
  }
});

export const workspaceDashboardOpenAPIHandler = new OpenAPIHandler(workspaceDashboardORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceDashboardORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceDashboardOpenAPIHandler.handle(event.req, {
      prefix: '/api/application/v1',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
