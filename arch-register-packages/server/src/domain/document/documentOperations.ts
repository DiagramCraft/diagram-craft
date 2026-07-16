import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { defineOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  requireProjectAction,
  requireProjectAccess,
  requireWorkspaceCapability
} from '../auth/authorization';
import type {
  DocumentTemplate,
  DocumentTemplateWrite,
  DocumentType,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';
import type { DocumentTypeDbResult } from './db/documentDatabase';
import { validateDocumentMetadata, validateDocumentTypeWrite } from './documentValidation';

const dbErrorMessages = {
  unique: 'A document type or template with that name already exists',
  foreign: 'The document type, project, or workspace does not exist'
} as const;

const toApiType = (row: DocumentTypeDbResult): DocumentType => ({
  ...row,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString()
});
const toApiTemplate = (
  row: Awaited<ReturnType<DatabaseAdapter['document']['getDocumentTemplate']>>
): DocumentTemplate => {
  httpAssert.present(row, { status: 404, message: 'Document template not found' });
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
};

const requireProjectTemplateAccess = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  authCtx: Parameters<typeof requireProjectAccess>[0],
  edit: boolean
) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  if (edit)
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to manage project templates'
    );
  else requireProjectAccess(authCtx, project.owner);
  return project.id;
};

const requireDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  allowArchived: boolean
) => {
  const documentType = await db.document.getDocumentType(workspace, id);
  httpAssert.present(documentType, { status: 400, message: `Document type '${id}' not found` });
  httpAssert.true(allowArchived || !documentType.archived, {
    status: 409,
    message: `Archived document type '${id}' cannot be used for new templates`
  });
  return documentType;
};

const validateTemplateDefaults = (
  fields: DocumentType['fields'],
  metadata: DocumentTemplateWrite['metadata_defaults']
) => {
  const validation = validateDocumentMetadata(fields, metadata, true, true);
  httpAssert.true(validation.errors.length === 0, {
    status: 400,
    message: `Template metadata defaults are invalid: ${validation.errors.join('; ')}`
  });
};

export const listDocumentTypes = async (
  db: DatabaseAdapter,
  workspace: string,
  includeArchived: boolean | undefined,
  event: AuthenticatedEvent
): Promise<DocumentType[]> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve document types', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      return (await db.document.listDocumentTypes(ws, includeArchived)).map(toApiType);
    }
  );

export const getDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<DocumentType> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve document type', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const row = await db.document.getDocumentType(ws, id);
      httpAssert.present(row, { status: 404, message: `Document type '${id}' not found` });
      return toApiType(row);
    }
  );

export const createDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  input: DocumentTypeWrite,
  event: AuthenticatedEvent
): Promise<DocumentType> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create document type', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');
      validateDocumentTypeWrite(input);
      const now = new Date();
      return toApiType(
        await db.document.createDocumentType({
          ...input,
          id: randomUUID(),
          workspace: ws,
          created_at: now,
          updated_at: now
        })
      );
    }
  );

export const updateDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: DocumentTypeWrite,
  event: AuthenticatedEvent
): Promise<DocumentType> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update document type', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');
      validateDocumentTypeWrite(input);
      const current = await db.document.getDocumentType(ws, id);
      httpAssert.present(current, { status: 404, message: `Document type '${id}' not found` });
      const used = new Set<string>();
      for (const node of await db.project.listAllContentNodes(ws)) {
        const metadata = await db.document.getDocumentMetadata(ws, node.id);
        if (metadata?.document_type_id === id) {
          for (const field of current.fields)
            if (metadata.values[field.id] !== undefined) used.add(field.id);
        }
        for (const revision of await db.project.listMarkdownRevisions(ws, node.id)) {
          if (revision.document_type_id !== id) continue;
          for (const field of current.fields)
            if (revision.metadata[field.id] !== undefined) used.add(field.id);
        }
      }
      for (const template of await db.document.listDocumentTemplates(ws, undefined, true)) {
        if (template.document_type_id !== id) continue;
        for (const field of current.fields)
          if (template.metadata_defaults[field.id] !== undefined) used.add(field.id);
      }
      const incoming = new Map(input.fields.map(field => [field.id, field]));
      const fields = input.fields.slice();
      for (const oldField of current.fields) {
        const next = incoming.get(oldField.id);
        if (next) {
          if (used.has(oldField.id))
            httpAssert.true(next.type === oldField.type, {
              status: 409,
              message: `Field '${oldField.id}' is in use and cannot change type`
            });
          continue;
        }
        if (used.has(oldField.id)) fields.push({ ...oldField, retired: true });
      }
      const now = new Date();
      const row = await db.document.updateDocumentType(ws, id, {
        ...input,
        fields,
        updated_at: now
      });
      httpAssert.present(row, { status: 404, message: `Document type '${id}' not found` });
      return toApiType(row);
    }
  );

export const archiveDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  archived: boolean,
  event: AuthenticatedEvent
): Promise<DocumentType> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to archive document type', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');
      const row = await db.document.archiveDocumentType(ws, id, archived, new Date());
      httpAssert.present(row, { status: 404, message: `Document type '${id}' not found` });
      return toApiType(row);
    }
  );

export const deleteDocumentType = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete document type', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');
      const current = await db.document.getDocumentType(ws, id);
      httpAssert.present(current, { status: 404, message: `Document type '${id}' not found` });
      for (const node of await db.project.listAllContentNodes(ws)) {
        const metadata = await db.document.getDocumentMetadata(ws, node.id);
        if (metadata?.document_type_id === id) {
          httpAssert.true(false, {
            status: 409,
            message: 'Document type is in use and must be archived'
          });
        }
        if (
          (await db.project.listMarkdownRevisions(ws, node.id)).some(
            revision => revision.document_type_id === id
          )
        ) {
          httpAssert.true(false, {
            status: 409,
            message: 'Document type is referenced by revision history and must be archived'
          });
        }
      }
      if (
        (await db.document.listDocumentTemplates(ws, undefined, true)).some(
          template => template.document_type_id === id
        )
      ) {
        httpAssert.true(false, {
          status: 409,
          message: 'Document type is used by a template and must be archived'
        });
      }
      await db.document.deleteDocumentType(ws, id);
      return { deleted: true };
    }
  );

export const listDocumentTemplates = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string | null | undefined,
  includeArchived: boolean | undefined,
  event: AuthenticatedEvent
): Promise<DocumentTemplate[]> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve document templates', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const resolvedProjectId = projectId
        ? await requireProjectTemplateAccess(db, ws, projectId, authCtx, false)
        : projectId;
      if (!projectId) requireWorkspaceCapability(authCtx, 'ws.view');
      return (await db.document.listDocumentTemplates(ws, resolvedProjectId, includeArchived)).map(
        row => ({
          ...row,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString()
        })
      );
    }
  );

export const createDocumentTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  input: DocumentTemplateWrite,
  event: AuthenticatedEvent
): Promise<DocumentTemplate> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create document template', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const projectId = input.project_id
        ? await requireProjectTemplateAccess(db, ws, input.project_id, authCtx, true)
        : null;
      const documentType = await requireDocumentType(db, ws, input.document_type_id, false);
      validateTemplateDefaults(documentType.fields, input.metadata_defaults ?? {});
      const now = new Date();
      return toApiTemplate(
        await db.document.createDocumentTemplate({
          ...input,
          id: randomUUID(),
          workspace: ws,
          project_id: projectId,
          document_type_id: input.document_type_id,
          metadata_defaults: input.metadata_defaults ?? {},
          created_at: now,
          updated_at: now
        })
      );
    }
  );

export const updateDocumentTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: DocumentTemplateWrite,
  event: AuthenticatedEvent
): Promise<DocumentTemplate> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update document template', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const current = await db.document.getDocumentTemplate(ws, id);
      httpAssert.present(current, { status: 404, message: `Document template '${id}' not found` });
      const projectIdInput = input.project_id !== undefined ? input.project_id : current.project_id;
      const documentTypeId = input.document_type_id;
      const projectId = projectIdInput
        ? await requireProjectTemplateAccess(db, ws, projectIdInput, authCtx, true)
        : null;
      if (!projectIdInput) requireWorkspaceCapability(authCtx, 'ws.settings');
      const documentType = await requireDocumentType(
        db,
        ws,
        documentTypeId,
        documentTypeId === current.document_type_id
      );
      validateTemplateDefaults(documentType.fields, input.metadata_defaults ?? {});
      const now = new Date();
      const row = await db.document.updateDocumentTemplate(ws, id, {
        ...input,
        project_id: projectId,
        document_type_id: documentTypeId,
        metadata_defaults: input.metadata_defaults,
        updated_at: now
      });
      return toApiTemplate(row);
    }
  );

export const archiveDocumentTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  archived: boolean,
  event: AuthenticatedEvent
): Promise<DocumentTemplate> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to archive document template', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const current = await db.document.getDocumentTemplate(ws, id);
      httpAssert.present(current, { status: 404, message: `Document template '${id}' not found` });
      if (current.project_id)
        await requireProjectTemplateAccess(db, ws, current.project_id, authCtx, true);
      else requireWorkspaceCapability(authCtx, 'ws.settings');
      return toApiTemplate(await db.document.archiveDocumentTemplate(ws, id, archived, new Date()));
    }
  );

export const deleteDocumentTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete document template', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const current = await db.document.getDocumentTemplate(ws, id);
      httpAssert.present(current, { status: 404, message: `Document template '${id}' not found` });
      if (current.project_id)
        await requireProjectTemplateAccess(db, ws, current.project_id, authCtx, true);
      else requireWorkspaceCapability(authCtx, 'ws.settings');
      await db.document.deleteDocumentTemplate(ws, id);
      return { deleted: true };
    }
  );
