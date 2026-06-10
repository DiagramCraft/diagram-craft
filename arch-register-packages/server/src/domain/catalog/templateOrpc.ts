import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { workspaceTemplateContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError } from '../../utils/orpcErrors';
import { listAllTemplates, listProjectTemplates } from './templateOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const templateRouter = implement(workspaceTemplateContract).$context<ORPCContext>();

export const workspaceTemplateORPCRouter = templateRouter.router({
  templates: {
    listAll: templateRouter.templates.listAll.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listAllTemplates(context.db, workspace, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    listForProject: templateRouter.templates.listForProject.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listProjectTemplates(context.db, workspace, input.projectId, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceTemplateOpenAPIHandler = new OpenAPIHandler(workspaceTemplateORPCRouter);

let generatedTemplateOpenAPISpec: Promise<object> | null = null;

export const getWorkspaceTemplateOpenAPISpec = () => {
  generatedTemplateOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(workspaceTemplateContract, {
    info: {
      title: 'Arch Register Template POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api' }]
  });

  return generatedTemplateOpenAPISpec;
};

export const createWorkspaceTemplateOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getWorkspaceTemplateOpenAPISpec()));

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
