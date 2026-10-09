import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import { requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  createApplication,
  deleteApplication,
  listApplicationsWithDashboards,
  reorderApplications,
  toApiApplication,
  updateApplication
} from './applicationOperations';
import { workspaceApplicationContract } from '@arch-register/api-types/applicationContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const applicationRouter = implement(workspaceApplicationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const workspaceApplicationORPCRouter = applicationRouter.router({
  workspaceApplications: {
    list: applicationRouter.workspaceApplications.list.handler(async ({ context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await listApplicationsWithDashboards(context.db, workspace);
    }),
    create: applicationRouter.workspaceApplications.create.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      const { application } = await createApplication(
        context.db,
        workspace,
        input.body,
        context.event.context.user.id
      );
      return toApiApplication(application);
    }),
    reorder: applicationRouter.workspaceApplications.reorder.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await reorderApplications(
        context.db,
        workspace,
        input.body.ids,
        context.event.context.user.id
      );
    }),
    update: applicationRouter.workspaceApplications.update.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await updateApplication(
        context.db,
        workspace,
        input.params.id,
        input.body,
        context.event.context.user.id
      );
    }),
    remove: applicationRouter.workspaceApplications.remove.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.manage_dashboard');
      return await deleteApplication(context.db, workspace, input.params.id);
    })
  }
});

export const createWorkspaceApplicationORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceApplicationORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
