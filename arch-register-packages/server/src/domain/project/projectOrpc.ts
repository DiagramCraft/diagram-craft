import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
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
  listProjectFiles,
  createFolder,
  renameFolder
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
    }),
    createFolder: projectRouter.projects.createFolder.handler(async ({ input, context }) => {
      try {
        return await createFolder(
          context.db,
          input.workspace,
          input.id,
          input.path,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    renameFolder: projectRouter.projects.renameFolder.handler(async ({ input, context }) => {
      try {
        return await renameFolder(
          context.db,
          input.workspace,
          input.id,
          input.oldPath,
          input.newPath,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const projectOpenAPIHandler = new OpenAPIHandler(projectORPCRouter);

export const createProjectORPCHandler = (db: DatabaseAdapter, storage?: StorageAdapter) =>
  defineHandler(async event => {
    const result = await projectOpenAPIHandler.handle(event.req, {
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
