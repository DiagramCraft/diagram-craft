import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import { requireProjectAccess, requireProjectAction } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { getOrSeedProjectDashboard, updateProjectDashboard } from './projectDashboardOperations';
import { projectDashboardContract } from '@arch-register/api-types/dashboardContract';
import { httpAssert } from '../../utils/httpAssert';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const projectDashboardRouter = implement(projectDashboardContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const projectDashboardORPCRouter = projectDashboardRouter.router({
  projectDashboard: {
    get: projectDashboardRouter.projectDashboard.get.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      const project = await context.db.project.getProject(workspace, input.params.projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${input.params.projectId}' not found`
      });
      requireProjectAccess(authCtx, project.owner);
      return await getOrSeedProjectDashboard(context.db, workspace, project.id);
    }),
    update: projectDashboardRouter.projectDashboard.update.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      const project = await context.db.project.getProject(workspace, input.params.projectId);
      httpAssert.present(project, {
        status: 404,
        message: `Project '${input.params.projectId}' not found`
      });
      requireProjectAction(authCtx, project.owner, 'edit_project');
      return await updateProjectDashboard(
        context.db,
        workspace,
        project.id,
        input.body,
        context.event.context.user.id
      );
    })
  }
});

export const createProjectDashboardORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(projectDashboardORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
