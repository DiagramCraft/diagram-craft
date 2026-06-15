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
  createEntityFile,
  deleteEntityFile,
  deleteEntityFolder,
  renameEntityFolder,
  cloneEntityFile,
  relocateEntityFile,
  listWorkspaceContentNodes,
  createWorkspaceFolder,
  createWorkspaceFile,
  getWorkspaceFileContent,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  renameWorkspaceFolder,
  cloneWorkspaceFile,
  relocateWorkspaceFile,
  createProjectMarkdownDoc,
  createEntityMarkdownDoc,
  createWorkspaceMarkdownDoc,
  getMarkdownContent,
  saveMarkdownContent
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
    ),
    deleteEntityFile: projectRouter.projects.deleteEntityFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await deleteEntityFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    deleteEntityFolder: projectRouter.projects.deleteEntityFolder.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await deleteEntityFolder(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    renameEntityFolder: projectRouter.projects.renameEntityFolder.handler(
      async ({ input, context }) => {
        try {
          return await renameEntityFolder(
            context.db,
            input.params.workspace,
            input.params.entityId,
            input.body.oldPath,
            input.body.newPath,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    cloneEntityFile: projectRouter.projects.cloneEntityFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await cloneEntityFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    relocateEntityFile: projectRouter.projects.relocateEntityFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await relocateEntityFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.query.path,
            input.body.newPath,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    listWorkspaceFiles: projectRouter.projects.listWorkspaceFiles.handler(
      async ({ input, context }) => {
        try {
          return await listWorkspaceContentNodes(context.db, input.params.workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createWorkspaceFolder: projectRouter.projects.createWorkspaceFolder.handler(
      async ({ input, context }) => {
        try {
          return await createWorkspaceFolder(
            context.db,
            input.params.workspace,
            input.body.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createWorkspaceFile: projectRouter.projects.createWorkspaceFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await createWorkspaceFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            input.body,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    getWorkspaceFileContent: projectRouter.projects.getWorkspaceFileContent.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await getWorkspaceFileContent(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    saveWorkspaceFile: projectRouter.projects.saveWorkspaceFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await saveWorkspaceFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            input.body,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    deleteWorkspaceFile: projectRouter.projects.deleteWorkspaceFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await deleteWorkspaceFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    deleteWorkspaceFolder: projectRouter.projects.deleteWorkspaceFolder.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await deleteWorkspaceFolder(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    renameWorkspaceFolder: projectRouter.projects.renameWorkspaceFolder.handler(
      async ({ input, context }) => {
        try {
          return await renameWorkspaceFolder(
            context.db,
            input.params.workspace,
            input.body.oldPath,
            input.body.newPath,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    cloneWorkspaceFile: projectRouter.projects.cloneWorkspaceFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await cloneWorkspaceFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    relocateWorkspaceFile: projectRouter.projects.relocateWorkspaceFile.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await relocateWorkspaceFile(
            context.db,
            context.storage,
            input.params.workspace,
            input.query.path,
            input.body.newPath,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createProjectMarkdown: projectRouter.projects.createProjectMarkdown.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await createProjectMarkdownDoc(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.id,
            input.body.name,
            input.body.folder,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createEntityMarkdown: projectRouter.projects.createEntityMarkdown.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await createEntityMarkdownDoc(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.entityId,
            input.body.name,
            input.body.folder,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    createWorkspaceMarkdown: projectRouter.projects.createWorkspaceMarkdown.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await createWorkspaceMarkdownDoc(
            context.db,
            context.storage,
            input.params.workspace,
            input.body.name,
            input.body.folder,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    getMarkdownContent: projectRouter.projects.getMarkdownContent.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await getMarkdownContent(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.nodeId,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),
    saveMarkdownContent: projectRouter.projects.saveMarkdownContent.handler(
      async ({ input, context }) => {
        try {
          if (!context.storage) throw new Error('Storage adapter not available');
          return await saveMarkdownContent(
            context.db,
            context.storage,
            input.params.workspace,
            input.params.nodeId,
            input.body.body,
            input.body.name,
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
