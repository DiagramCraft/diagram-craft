import {
  createEntityFile,
  createWorkspaceFile,
  getFileContent,
  getWorkspaceFileContent,
  relocateContentFile,
  saveFile,
  saveWorkspaceFile,
  cloneContentFile
} from './contentFileOperations';
import {
  createEntityFolder,
  createFolder,
  createWorkspaceFolder,
  listEntityContentNodes,
  listProjectFiles,
  listWorkspaceContentNodes,
  updateTemplateStatus
} from './contentNodeOperations';
import {
  deleteContentFile,
  deleteContentFolder,
  renameContentFolder
} from './contentTreeOperations';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import { projectRouter } from './projectRouter';

export const projectContentHandlers = {
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
  listWorkspaceFiles: projectRouter.projects.listWorkspaceFiles.handler(
    async ({ input, context }) => {
      return await listWorkspaceContentNodes(context.db, input.params.workspace, context.event);
    }
  ),
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
  )
};
