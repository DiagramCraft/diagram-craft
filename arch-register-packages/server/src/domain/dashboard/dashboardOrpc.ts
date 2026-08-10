import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import { requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  createWorkspaceDashboard,
  deleteWorkspaceDashboard,
  getWorkspaceDashboard,
  listWorkspaceDashboards,
  updateWorkspaceDashboard
} from './dashboardOperations';
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
  dashboards: {
    list: dashboardRouter.dashboards.list.handler(async ({ context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await listWorkspaceDashboards(context.db, workspace);
    }),
    create: dashboardRouter.dashboards.create.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await createWorkspaceDashboard(
        context.db,
        workspace,
        input.body,
        context.event.context.user.id
      );
    }),
    get: dashboardRouter.dashboards.get.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await getWorkspaceDashboard(context.db, workspace, input.params.id);
    }),
    update: dashboardRouter.dashboards.update.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await updateWorkspaceDashboard(
        context.db,
        workspace,
        input.params.id,
        input.body,
        context.event.context.user.id
      );
    }),
    remove: dashboardRouter.dashboards.remove.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await deleteWorkspaceDashboard(context.db, workspace, input.params.id);
    })
  }
});

export const createWorkspaceDashboardORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceDashboardORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
