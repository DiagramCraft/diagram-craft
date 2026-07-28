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
import {
  createPersonalDashboard,
  deletePersonalDashboard,
  getPersonalDashboard,
  listPersonalDashboards,
  updatePersonalDashboard
} from './personalDashboardOperations';
import { personalDashboardContract } from '@arch-register/api-types/dashboardContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const personalDashboardRouter = implement(personalDashboardContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const personalDashboardORPCRouter = personalDashboardRouter.router({
  personalDashboards: {
    list: personalDashboardRouter.personalDashboards.list.handler(async ({ context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await listPersonalDashboards(context.db, context.event.context.user.id, workspace);
    }),
    create: personalDashboardRouter.personalDashboards.create.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await createPersonalDashboard(
          context.db,
          context.event.context.user.id,
          workspace,
          input.body
        );
      }
    ),
    get: personalDashboardRouter.personalDashboards.get.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await getPersonalDashboard(
        context.db,
        context.event.context.user.id,
        workspace,
        input.params.id
      );
    }),
    update: personalDashboardRouter.personalDashboards.update.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await updatePersonalDashboard(
          context.db,
          context.event.context.user.id,
          workspace,
          input.params.id,
          input.body
        );
      }
    ),
    remove: personalDashboardRouter.personalDashboards.remove.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await deletePersonalDashboard(
          context.db,
          context.event.context.user.id,
          workspace,
          input.params.id
        );
      }
    )
  }
});

export const personalDashboardOpenAPIHandler = new OpenAPIHandler(personalDashboardORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createPersonalDashboardORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await personalDashboardOpenAPIHandler.handle(event.req, {
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
