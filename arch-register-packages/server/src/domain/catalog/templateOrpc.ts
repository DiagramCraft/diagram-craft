import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listAllTemplates,
  listProjectTemplates,
  toggleTemplateStatus,
  createFromTemplate
} from './templateOperations';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import type { StorageAdapter } from '../../storage/storage';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

const templateRouter = implement(workspaceTemplateContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceTemplateORPCRouter = templateRouter.router({
  templates: {
    listAll: templateRouter.templates.listAll.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      return await listAllTemplates(context.db, workspace, authCtx);
    }),

    listForProject: templateRouter.templates.listForProject.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      return await listProjectTemplates(context.db, workspace, input.params.id, authCtx);
    }),
    toggleStatus: templateRouter.templates.toggleStatus.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      return await toggleTemplateStatus(
        context.db,
        workspace,
        input.params.id,
        input.params.path,
        input.body.is_template,
        input.body.is_workspace_template,
        authCtx
      );
    }),
    createFromTemplate: templateRouter.templates.createFromTemplate.handler(
      async ({ input, context }) => {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await createFromTemplate(
          context.db,
          context.storage,
          workspace,
          input.params.id,
          input.body.name,
          input.body.templateProjectId,
          input.body.templatePath,
          input.body.folder,
          authCtx
        );
      }
    )
  }
});

export const workspaceTemplateOpenAPIHandler = new OpenAPIHandler(workspaceTemplateORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceTemplateORPCHandler = (db: DatabaseAdapter, storage?: StorageAdapter) =>
  defineHandler(async event => {
    const result = await workspaceTemplateOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        storage,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
