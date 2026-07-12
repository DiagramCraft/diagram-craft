import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
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
      return await listAllTemplates(context.db, input.params.workspace, context.event);
    }),

    listForProject: templateRouter.templates.listForProject.handler(async ({ input, context }) => {
      return await listProjectTemplates(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    toggleStatus: templateRouter.templates.toggleStatus.handler(async ({ input, context }) => {
      return await toggleTemplateStatus(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.path,
        input.body.is_template,
        input.body.is_workspace_template,
        context.event
      );
    }),
    createFromTemplate: templateRouter.templates.createFromTemplate.handler(
      async ({ input, context }) => {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await createFromTemplate(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.body.name,
          input.body.templateProjectId,
          input.body.templatePath,
          input.body.folder,
          context.event
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
