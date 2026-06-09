import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { projectContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError } from '../../utils/orpcErrors';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listProjectFiles
} from './projectOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

const projectRouter = implement(projectContract).$context<ORPCContext>();

export const projectORPCRouter = projectRouter.router({
  projects: {
    list: projectRouter.projects.list.handler(async ({ input, context }) => {
      try {
        return await listProjects(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: projectRouter.projects.get.handler(async ({ input, context }) => {
      try {
        return await getProject(context.db, input.workspace, input.id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: projectRouter.projects.create.handler(async ({ input, context }) => {
      try {
        return await createProject(context.db, input.workspace, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: projectRouter.projects.update.handler(async ({ input, context }) => {
      try {
        return await updateProject(context.db, input.workspace, input.id, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: projectRouter.projects.remove.handler(async ({ input, context }) => {
      try {
        return await deleteProject(
          context.db,
          input.workspace,
          input.id,
          context.event,
          context.storage
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    listFiles: projectRouter.projects.listFiles.handler(async ({ input, context }) => {
      try {
        return await listProjectFiles(context.db, input.workspace, input.id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const projectOpenAPIHandler = new OpenAPIHandler(projectORPCRouter);

let generatedProjectOpenAPISpec: Promise<object> | null = null;

export const getProjectOpenAPISpec = () => {
  generatedProjectOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(projectContract, {
    info: {
      title: 'Arch Register Project POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api/poc-orpc' }]
  });

  return generatedProjectOpenAPISpec;
};

export const createProjectOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getProjectOpenAPISpec()));

export const createProjectORPCHandler = (db: DatabaseAdapter, storage?: StorageAdapter) =>
  defineHandler(async event => {
    const result = await projectOpenAPIHandler.handle(event.req, {
      prefix: '/api/poc-orpc',
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
