import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { listAllTemplates, listProjectTemplates } from './templateOperations';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const templateRouter = implement(workspaceTemplateContract).$context<ORPCContext>();

export const workspaceTemplateORPCRouter = templateRouter.router({
  templates: {
    listAll: templateRouter.templates.listAll.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listAllTemplates(context.db, workspace, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    listForProject: templateRouter.templates.listForProject.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listProjectTemplates(context.db, workspace, input.params.projectId, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceTemplateOpenAPIHandler = new OpenAPIHandler(workspaceTemplateORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceTemplateORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceTemplateOpenAPIHandler.handle(event.req, {
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
