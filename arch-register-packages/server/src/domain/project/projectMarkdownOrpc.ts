import {
  createEntityMarkdownDoc,
  createProjectMarkdownDoc,
  createWorkspaceMarkdownDoc,
  getMarkdownContent,
  getMarkdownRevision,
  listMarkdownRevisions,
  listMarkdownWorkflowHistory,
  migrateMarkdownContent,
  restoreMarkdownRevision,
  saveMarkdownContent,
  saveNewMarkdownContent
} from './markdownDocumentOperations';
import { getFileContentById, getProjectFile } from './contentFileOperations';
import { createMarkdownDiagramAttachment } from './markdownAttachmentOperations';
import { overrideDocumentWorkflow } from '../document/documentWorkflowOperations';
import { projectRouter } from './projectRouter';

export const projectMarkdownHandlers = {
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
        input.body.document_type_id,
        input.body.metadata,
        context.event,
        input.body.external,
        false,
        input.body.change_kind,
        input.body.initiation_fields
      );
    }
  ),
  migrateMarkdownContent: projectRouter.projects.migrateMarkdownContent.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await migrateMarkdownContent(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        input.body.body,
        input.body.name,
        input.body.document_type_id,
        input.body.metadata,
        context.event,
        input.body.change_kind,
        input.body.initiation_fields
      );
    }
  ),
  saveNewMarkdownContent: projectRouter.projects.saveNewMarkdownContent.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await saveNewMarkdownContent(
        context.db,
        context.storage,
        input.params.workspace,
        input.body,
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
  listMarkdownWorkflowHistory: projectRouter.projects.listMarkdownWorkflowHistory.handler(
    async ({ input, context }) =>
      listMarkdownWorkflowHistory(
        context.db,
        input.params.workspace,
        input.params.nodeId,
        context.event
      )
  ),
  overrideMarkdownWorkflow: projectRouter.projects.overrideMarkdownWorkflow.handler(
    async ({ input, context }) =>
      overrideDocumentWorkflow(
        context.db,
        input.params.workspace,
        input.params.nodeId,
        input.body.field_id,
        input.body.target_value,
        input.body.reason,
        context.event
      )
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
        context.event,
        input.body?.change_kind ?? 'major',
        input.body?.initiation_fields
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
