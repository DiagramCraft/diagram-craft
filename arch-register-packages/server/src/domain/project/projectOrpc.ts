import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listProjectFiles,
  createFolder,
  renameFolder,
  getFileContent,
  saveFile,
  deleteFile,
  cloneFile,
  relocateFile,
  deleteFolder
} from './projectOperations';
import { projectContract } from '@arch-register/api-types/projectContract';

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
        return await listProjects(context.db, input.params.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: projectRouter.projects.get.handler(async ({ input, context }) => {
      try {
        return await getProject(context.db, input.params.workspace, input.params.id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: projectRouter.projects.create.handler(async ({ input, context }) => {
      try {
        return await createProject(context.db, input.params.workspace, input.body, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: projectRouter.projects.update.handler(async ({ input, context }) => {
      try {
        return await updateProject(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: projectRouter.projects.remove.handler(async ({ input, context }) => {
      try {
        return await deleteProject(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          context.storage
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    listFiles: projectRouter.projects.listFiles.handler(async ({ input, context }) => {
      try {
        return await listProjectFiles(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    createFolder: projectRouter.projects.createFolder.handler(async ({ input, context }) => {
      try {
        return await createFolder(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body.path,
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
          input.params.workspace,
          input.params.id,
          input.body.oldPath,
          input.body.newPath,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    deleteFolder: projectRouter.projects.deleteFolder.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await deleteFolder(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    getFileContent: projectRouter.projects.getFileContent.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await getFileContent(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    saveFile: projectRouter.projects.saveFile.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await saveFile(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    deleteFile: projectRouter.projects.deleteFile.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await deleteFile(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    cloneFile: projectRouter.projects.cloneFile.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await cloneFile(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    relocateFile: projectRouter.projects.relocateFile.handler(async ({ input, context }) => {
      try {
        if (!context.storage) {
          throw new Error('Storage adapter not available');
        }
        return await relocateFile(
          context.db,
          context.storage,
          input.params.workspace,
          input.params.id,
          input.params.path,
          input.body.newPath,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const projectOpenAPIHandler = new OpenAPIHandler(projectORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

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
