import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from './projectCrudOperations';
import {
  listProjectFiles,
  createFolder,
  getFileContent,
  saveFile,
  cloneContentFile,
  relocateContentFile,
  updateTemplateStatus,
  listEntityContentNodes,
  createEntityFolder,
  createEntityFile,
  listWorkspaceContentNodes,
  createWorkspaceFolder,
  createWorkspaceFile,
  getWorkspaceFileContent,
  saveWorkspaceFile,
  getProjectFile,
  getFileContentById
} from './contentNodeOperations';
import {
  deleteContentFile,
  deleteContentFolder,
  renameContentFolder
} from './contentTreeOperations';
import { PROJECT_SCOPE, ENTITY_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import {
  listProjectEntities,
  addProjectEntity,
  updateProjectEntity,
  removeProjectEntity,
  getEntityProjects,
  getEntityDiagramFiles
} from './projectEntityOperations';
import {
  createProjectMarkdownDoc,
  createEntityMarkdownDoc,
  createWorkspaceMarkdownDoc,
  getMarkdownContent,
  saveMarkdownContent,
  listMarkdownRevisions,
  getMarkdownRevision,
  restoreMarkdownRevision,
  createMarkdownDiagramAttachment
} from './markdownOperations';
import { projectContract } from '@arch-register/api-types/projectContract';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

const projectRouter = implement(projectContract).$context<ORPCContext>().use(orpcErrorMiddleware);

const projectHandlers = {
  list: projectRouter.projects.list.handler(async ({ input, context }) => {
    return await listProjects(context.db, input.params.workspace, context.event);
  }),
  get: projectRouter.projects.get.handler(async ({ input, context }) => {
    return await getProject(context.db, input.params.workspace, input.params.id, context.event);
  }),
  create: projectRouter.projects.create.handler(async ({ input, context }) => {
    return await createProject(context.db, input.params.workspace, input.body, context.event);
  }),
  update: projectRouter.projects.update.handler(async ({ input, context }) => {
    return await updateProject(
      context.db,
      input.params.workspace,
      input.params.id,
      input.body,
      context.event
    );
  }),
  remove: projectRouter.projects.remove.handler(async ({ input, context }) => {
    return await deleteProject(
      context.db,
      input.params.workspace,
      input.params.id,
      context.event,
      context.storage
    );
  }),
  listFiles: projectRouter.projects.listFiles.handler(async ({ input, context }) => {
    return await listProjectFiles(
      context.db,
      input.params.workspace,
      input.params.id,
      context.event
    );
  }),
  createFolder: projectRouter.projects.createFolder.handler(async ({ input, context }) => {
    return await createFolder(
      context.db,
      input.params.workspace,
      input.params.id,
      input.body.path,
      context.event
    );
  }),
  renameFolder: projectRouter.projects.renameFolder.handler(async ({ input, context }) => {
    return await renameContentFolder(
      PROJECT_SCOPE,
      context.db,
      input.params.workspace,
      input.params.id,
      input.body.oldPath,
      input.body.newPath,
      context.event
    );
  }),
  deleteFolder: projectRouter.projects.deleteFolder.handler(async ({ input, context }) => {
    if (!context.storage) {
      throw new Error('Storage adapter not available');
    }
    return await deleteContentFolder(
      PROJECT_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.id,
      input.query.path,
      context.event
    );
  }),
  getFileContent: projectRouter.projects.getFileContent.handler(async ({ input, context }) => {
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
  }),
  saveFile: projectRouter.projects.saveFile.handler(async ({ input, context }) => {
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
  }),
  deleteFile: projectRouter.projects.deleteFile.handler(async ({ input, context }) => {
    if (!context.storage) {
      throw new Error('Storage adapter not available');
    }
    return await deleteContentFile(
      PROJECT_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.id,
      input.query.path,
      context.event
    );
  }),
  cloneFile: projectRouter.projects.cloneFile.handler(async ({ input, context }) => {
    if (!context.storage) {
      throw new Error('Storage adapter not available');
    }
    return await cloneContentFile(
      PROJECT_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.id,
      input.query.path,
      context.event
    );
  }),
  relocateFile: projectRouter.projects.relocateFile.handler(async ({ input, context }) => {
    if (!context.storage) {
      throw new Error('Storage adapter not available');
    }
    return await relocateContentFile(
      PROJECT_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.id,
      input.query.path,
      input.body.newPath,
      context.event
    );
  }),
  updateTemplateStatus: projectRouter.projects.updateTemplateStatus.handler(
    async ({ input, context }) => {
      return await updateTemplateStatus(
        context.db,
        input.params.workspace,
        input.params.id,
        input.query.path,
        input.body.is_template,
        input.body.is_workspace_template,
        context.event
      );
    }
  )
};

const entityContentHandlers = {
  listEntities: projectRouter.projects.listEntities.handler(async ({ input, context }) => {
    return await listProjectEntities(
      context.db,
      input.params.workspace,
      input.params.id,
      context.event
    );
  }),
  listEntityProjects: projectRouter.projects.listEntityProjects.handler(
    async ({ input, context }) => {
      return await getEntityProjects(
        context.db,
        input.params.workspace,
        input.params.entityId,
        context.event
      );
    }
  ),
  addEntity: projectRouter.projects.addEntity.handler(async ({ input, context }) => {
    return await addProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.body,
      context.event
    );
  }),
  updateEntity: projectRouter.projects.updateEntity.handler(async ({ input, context }) => {
    return await updateProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.params.entityId,
      input.body,
      context.event
    );
  }),
  removeEntity: projectRouter.projects.removeEntity.handler(async ({ input, context }) => {
    return await removeProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.params.entityId,
      context.event
    );
  }),
  getEntityDiagramFiles: projectRouter.projects.getEntityDiagramFiles.handler(
    async ({ input, context }) => {
      return await getEntityDiagramFiles(
        context.db,
        input.params.workspace,
        input.params.entityId,
        context.event
      );
    }
  ),
  listEntityFiles: projectRouter.projects.listEntityFiles.handler(async ({ input, context }) => {
    return await listEntityContentNodes(
      context.db,
      input.params.workspace,
      input.params.entityId,
      context.event
    );
  }),
  createEntityFolder: projectRouter.projects.createEntityFolder.handler(
    async ({ input, context }) => {
      return await createEntityFolder(
        context.db,
        input.params.workspace,
        input.params.entityId,
        input.body.path,
        context.event
      );
    }
  ),
  createEntityFile: projectRouter.projects.createEntityFile.handler(async ({ input, context }) => {
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
  }),
  deleteEntityFile: projectRouter.projects.deleteEntityFile.handler(async ({ input, context }) => {
    if (!context.storage) throw new Error('Storage adapter not available');
    return await deleteContentFile(
      ENTITY_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.entityId,
      input.query.path,
      context.event
    );
  }),
  deleteEntityFolder: projectRouter.projects.deleteEntityFolder.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await deleteContentFolder(
        ENTITY_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        input.params.entityId,
        input.query.path,
        context.event
      );
    }
  ),
  renameEntityFolder: projectRouter.projects.renameEntityFolder.handler(
    async ({ input, context }) => {
      return await renameContentFolder(
        ENTITY_SCOPE,
        context.db,
        input.params.workspace,
        input.params.entityId,
        input.body.oldPath,
        input.body.newPath,
        context.event
      );
    }
  ),
  cloneEntityFile: projectRouter.projects.cloneEntityFile.handler(async ({ input, context }) => {
    if (!context.storage) throw new Error('Storage adapter not available');
    return await cloneContentFile(
      ENTITY_SCOPE,
      context.db,
      context.storage,
      input.params.workspace,
      input.params.entityId,
      input.query.path,
      context.event
    );
  }),
  relocateEntityFile: projectRouter.projects.relocateEntityFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await relocateContentFile(
        ENTITY_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        input.params.entityId,
        input.query.path,
        input.body.newPath,
        context.event
      );
    }
  )
};

const workspaceContentHandlers = {
  listWorkspaceFiles: projectRouter.projects.listWorkspaceFiles.handler(
    async ({ input, context }) => {
      return await listWorkspaceContentNodes(context.db, input.params.workspace, context.event);
    }
  ),
  createWorkspaceFolder: projectRouter.projects.createWorkspaceFolder.handler(
    async ({ input, context }) => {
      return await createWorkspaceFolder(
        context.db,
        input.params.workspace,
        input.body.path,
        context.event
      );
    }
  ),
  createWorkspaceFile: projectRouter.projects.createWorkspaceFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await createWorkspaceFile(
        context.db,
        context.storage,
        input.params.workspace,
        input.query.path,
        input.body,
        context.event
      );
    }
  ),
  getWorkspaceFileContent: projectRouter.projects.getWorkspaceFileContent.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await getWorkspaceFileContent(
        context.db,
        context.storage,
        input.params.workspace,
        input.query.path,
        context.event
      );
    }
  ),
  saveWorkspaceFile: projectRouter.projects.saveWorkspaceFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await saveWorkspaceFile(
        context.db,
        context.storage,
        input.params.workspace,
        input.query.path,
        input.body,
        context.event
      );
    }
  ),
  deleteWorkspaceFile: projectRouter.projects.deleteWorkspaceFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await deleteContentFile(
        WORKSPACE_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        undefined,
        input.query.path,
        context.event
      );
    }
  ),
  deleteWorkspaceFolder: projectRouter.projects.deleteWorkspaceFolder.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await deleteContentFolder(
        WORKSPACE_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        undefined,
        input.query.path,
        context.event
      );
    }
  ),
  renameWorkspaceFolder: projectRouter.projects.renameWorkspaceFolder.handler(
    async ({ input, context }) => {
      return await renameContentFolder(
        WORKSPACE_SCOPE,
        context.db,
        input.params.workspace,
        undefined,
        input.body.oldPath,
        input.body.newPath,
        context.event
      );
    }
  ),
  cloneWorkspaceFile: projectRouter.projects.cloneWorkspaceFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await cloneContentFile(
        WORKSPACE_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        undefined,
        input.query.path,
        context.event
      );
    }
  ),
  relocateWorkspaceFile: projectRouter.projects.relocateWorkspaceFile.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await relocateContentFile(
        WORKSPACE_SCOPE,
        context.db,
        context.storage,
        input.params.workspace,
        undefined,
        input.query.path,
        input.body.newPath,
        context.event
      );
    }
  )
};

const markdownHandlers = {
  createProjectMarkdown: projectRouter.projects.createProjectMarkdown.handler(
    async ({ input, context }) => {
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
    }
  ),
  createEntityMarkdown: projectRouter.projects.createEntityMarkdown.handler(
    async ({ input, context }) => {
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
    }
  ),
  createWorkspaceMarkdown: projectRouter.projects.createWorkspaceMarkdown.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await createWorkspaceMarkdownDoc(
        context.db,
        context.storage,
        input.params.workspace,
        input.body.name,
        input.body.folder,
        context.event
      );
    }
  ),
  getFile: projectRouter.projects.getFile.handler(async ({ input, context }) => {
    return await getProjectFile(
      context.db,
      input.params.workspace,
      input.params.fileId,
      context.event
    );
  }),
  getDiagramContent: projectRouter.projects.getDiagramContent.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await getFileContentById(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.fileId,
        context.event
      );
    }
  ),
  getMarkdownContent: projectRouter.projects.getMarkdownContent.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await getMarkdownContent(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        context.event
      );
    }
  ),
  saveMarkdownContent: projectRouter.projects.saveMarkdownContent.handler(
    async ({ input, context }) => {
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
    }
  ),
  listMarkdownRevisions: projectRouter.projects.listMarkdownRevisions.handler(
    async ({ input, context }) => {
      return await listMarkdownRevisions(
        context.db,
        input.params.workspace,
        input.params.nodeId,
        context.event
      );
    }
  ),
  getMarkdownRevision: projectRouter.projects.getMarkdownRevision.handler(
    async ({ input, context }) => {
      return await getMarkdownRevision(
        context.db,
        input.params.workspace,
        input.params.nodeId,
        input.params.revisionId,
        context.event
      );
    }
  ),
  restoreMarkdownRevision: projectRouter.projects.restoreMarkdownRevision.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await restoreMarkdownRevision(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        input.params.revisionId,
        context.event
      );
    }
  ),
  createMarkdownDiagramAttachment: projectRouter.projects.createMarkdownDiagramAttachment.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await createMarkdownDiagramAttachment(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        input.body.name,
        input.body.content,
        context.event
      );
    }
  )
};

export const projectORPCRouter = projectRouter.router({
  projects: {
    ...projectHandlers,
    ...entityContentHandlers,
    ...workspaceContentHandlers,
    ...markdownHandlers
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
