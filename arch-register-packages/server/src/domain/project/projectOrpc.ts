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
  deleteFolder,
  updateTemplateStatus,
  listProjectEntities,
  addProjectEntity,
  updateProjectEntity,
  removeProjectEntity,
  getEntityDiagramFiles,
  listEntityContentNodes,
  createEntityFolder,
  createEntityFile
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
          input.query.path,
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
          input.query.path,
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
          input.query.path,
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
          input.query.path,
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
          input.query.path,
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
          input.query.path,
          input.body.newPath,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    updateTemplateStatus: projectRouter.projects.updateTemplateStatus.handler(
      async ({ input, context }) => {
        try {
          return await updateTemplateStatus(
            context.db,
            input.params.workspace,
            input.params.id,
            input.query.path,
            input.body.is_template,
            input.body.is_workspace_template,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    listEntities: projectRouter.projects.listEntities.handler(async ({ input, context }) => {
      try {
        return await listProjectEntities(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    addEntity: projectRouter.projects.addEntity.handler(async ({ input, context }) => {
      try {
        return await addProjectEntity(
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
    updateEntity: projectRouter.projects.updateEntity.handler(async ({ input, context }) => {
      try {
        return await updateProjectEntity(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.entityId,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    removeEntity: projectRouter.projects.removeEntity.handler(async ({ input, context }) => {
      try {
        return await removeProjectEntity(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.entityId,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    getEntityDiagramFiles: projectRouter.projects.getEntityDiagramFiles.handler(
      async ({ input, context }) => {
        try {
          return await getEntityDiagramFiles(
            context.db,
            input.params.workspace,
            input.params.entityId,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    listEntityFiles: projectRouter.projects.listEntityFiles.handler(
      async ({ input, context }) => {
        try {
          return await listEntityContentNodes(
            context.db,
            input.params.workspace,
            input.params.entityId,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createEntityFolder: projectRouter.projects.createEntityFolder.handler(
      async ({ input, context }) => {
        try {
          return await createEntityFolder(
            context.db,
            input.params.workspace,
            input.params.entityId,
            input.body.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createEntityFile: projectRouter.projects.createEntityFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) {
            throw new Error('Storage adapter not available');
          }
          return await createEntityFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.query.path,
            input.body,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    )
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
