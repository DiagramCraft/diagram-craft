import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { writeAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';

import { getMarkdownAttachmentNodes } from './contentNodeRoleUtils';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult, MarkdownRevisionDbResult } from './db/projectDatabase';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { ContentScopeResolver } from './contentScope';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import type {
  MarkdownContent,
  MarkdownRevisionDetail,
  MarkdownRevisionSummary,
  ProjectFile
} from '@arch-register/api-types/projectContract';

const EMPTY_MARKDOWN_BODY = JSON.stringify({ body: '' });

import type { DocumentMetadata } from '@arch-register/api-types/documentContract';

import {
  assertDocumentMetadataValid,
  assertNoExternalDocumentFieldWrites,
  validateDocumentMetadata
} from '../document/documentValidation';
import type { ExternalUpdateEnvelope } from '@arch-register/api-types/common';
import {
  applyExternalFieldUpdate,
  assertNoExternalFieldWrites,
  assertValidExternalUpdateTarget
} from '../externalMetadata/externalMetadataHelpers';

import { coordinateContentWrite } from './contentWriteCoordinator';
import { scheduleMetadataGenerationForDocument } from '../document/documentMetadataGenerationJob';
import {
  listSiblingNodes,
  projectDbErrorMessages,
  storageScope,
  assertContentPathWritable
} from './projectOperationHelpers';

import {
  toApiMarkdownRevisionSummary,
  toApiMarkdownRevisionDetail,
  createContentNodeRevision,
  getDocumentState,
  metadataEquals,
  outdateGeneratedMetadata,
  resolveDocumentMetadata,
  requireMarkdownNodeAccess,
  isMarkdownNode,
  readMarkdownBody
} from './markdownOperationHelpers';
import {
  applyDocumentWorkflowSave,
  getDocumentWorkflowStatuses,
  listDocumentWorkflowHistory
} from '../document/documentWorkflowOperations';
const createScopedMarkdownDoc = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const filePath = folder ? `${folder}/${name}.md` : `${name}.md`;
  assertContentPathWritable(nodes, filePath);
  const parentId = folder
    ? (nodes.find(node => node.path === folder && node.type === 'folder')?.id ?? null)
    : null;
  const content = Buffer.from(EMPTY_MARKDOWN_BODY);
  const timestamp = new Date();
  const nodeId = randomUUID();
  let row!: ContentNodeDbResult;
  await coordinateContentWrite({
    db,
    storage,
    operation: 'create-markdown',
    scope: resolved.kind,
    nodeIds: [nodeId],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId,
        content
      }
    ],
    writeDatabase: async tx => {
      row = await tx.project.upsertContentNode({
        id: nodeId,
        workspace: ws,
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: parentId,
        path: filePath,
        name,
        type: 'markdown',
        size_bytes: content.length,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: timestamp,
        updated_at: timestamp,
        created_byIfNew: authCtx.userId,
        updated_by: authCtx.userId
      });
    },
    afterCommit: [
      {
        name: 'audit',
        run: () =>
          writeAudit(db, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'content_node',
            entityId: nodeId,
            entityName: row.name,
            changes: { new: extractEntityFields(row) },
            metadata: { ...resolved.auditMetadata, path: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(row);
};

export const saveNewMarkdownContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  input: {
    scope: 'project' | 'entity' | 'workspace';
    project_id?: string;
    entity_id?: string;
    name: string;
    folder?: string;
    body: string;
    document_type_id?: string | null;
    metadata: DocumentMetadata;
  },
  event: AuthenticatedEvent
): Promise<ProjectFile> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create markdown document', dbErrorMessages: projectDbErrorMessages },
    async ({ ws, authCtx }) => {
      const scope =
        input.scope === 'project'
          ? PROJECT_SCOPE
          : input.scope === 'entity'
            ? ENTITY_SCOPE
            : WORKSPACE_SCOPE;
      const identifier =
        input.scope === 'project'
          ? input.project_id
          : input.scope === 'entity'
            ? input.entity_id
            : undefined;
      if (input.scope === 'project')
        httpAssert.present(input.project_id, {
          status: 400,
          message: 'Project identifier is required'
        });
      if (input.scope === 'entity')
        httpAssert.present(input.entity_id, {
          status: 400,
          message: 'Entity identifier is required'
        });
      const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
      const nodes = await resolved.listNodes(db, ws);
      const filePath = input.folder ? `${input.folder}/${input.name}.md` : `${input.name}.md`;
      assertContentPathWritable(nodes, filePath);
      const parentId = input.folder
        ? (nodes.find(node => node.path === input.folder && node.type === 'folder')?.id ?? null)
        : null;
      const documentType = input.document_type_id
        ? await db.document.getDocumentType(ws, input.document_type_id)
        : null;
      if (input.document_type_id)
        httpAssert.present(documentType, {
          status: 400,
          message: `Document type '${input.document_type_id}' not found`
        });
      if (documentType) {
        httpAssert.true(!documentType.archived, {
          status: 409,
          message: `Archived document type '${documentType.id}' cannot be selected for a new document`
        });
      }
      const resolvedMetadata = documentType
        ? await resolveDocumentMetadata(db, ws, documentType.fields, input.metadata)
        : { values: input.metadata, links: [] };
      assertDocumentMetadataValid(documentType?.fields ?? [], resolvedMetadata.values, true);
      const nodeId = randomUUID();
      const timestamp = new Date();
      const content = Buffer.from(JSON.stringify({ body: input.body }), 'utf8');
      let row!: ContentNodeDbResult;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'create-markdown-document',
        scope: resolved.kind,
        nodeIds: [nodeId],
        storageChanges: [
          { type: 'write', workspace: ws, storageId: resolved.storageId, nodeId, content }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: nodeId,
            workspace: ws,
            project_id: resolved.projectId,
            entity_id: resolved.entityId,
            parent_id: parentId,
            path: filePath,
            name: input.name,
            type: 'markdown',
            size_bytes: content.length,
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: timestamp,
            updated_at: timestamp,
            created_byIfNew: authCtx.userId,
            updated_by: authCtx.userId
          });
          const revision = await createContentNodeRevision(
            tx,
            ws,
            nodeId,
            input.body,
            input.name,
            authCtx.userId,
            timestamp,
            null,
            input.document_type_id,
            resolvedMetadata.values,
            tx
          );
          const effectiveMetadata = await applyDocumentWorkflowSave(tx, {
            workspace: ws,
            nodeId,
            documentType,
            currentMetadata: {},
            nextMetadata: resolvedMetadata.values,
            changeKind: 'major',
            isNew: true,
            initiatorUserId: authCtx.userId,
            sourceRevision: revision.revision_number
          });
          if (input.document_type_id || Object.keys(effectiveMetadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: nodeId,
              document_type_id: input.document_type_id ?? null,
              values: effectiveMetadata,
              generated_metadata: {},
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, nodeId, resolvedMetadata.links);
          }
        },
        afterCommit: [
          {
            name: 'audit',
            run: () =>
              writeAudit(db, {
                userId: authCtx.userId,
                workspace: ws,
                operation: 'create',
                entityType: 'content_node',
                entityId: row.id,
                entityName: row.name,
                changes: { new: extractEntityFields(row) },
                metadata: { ...resolved.auditMetadata, path: filePath }
              })
          }
        ]
      });
      return toApiProjectFile(row);
    }
  );

export const createProjectMarkdownDoc = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  projectId: string,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return createScopedMarkdownDoc(
    PROJECT_SCOPE,
    db,
    storage,
    workspace,
    projectId,
    name,
    folder,
    event
  );
};

export const createEntityMarkdownDoc = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return createScopedMarkdownDoc(
    ENTITY_SCOPE,
    db,
    storage,
    workspace,
    entityId,
    name,
    folder,
    event
  );
};

export const createWorkspaceMarkdownDoc = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return createScopedMarkdownDoc(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    name,
    folder,
    event
  );
};

export const getMarkdownContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<MarkdownContent> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve markdown content',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const siblingNodes = await listSiblingNodes(db, ws, node);
      const attachments = getMarkdownAttachmentNodes(siblingNodes, node.id).map(toApiProjectFile);
      const content = await storage.read(ws, storageScope(ws, node), node.id);
      const document = await getDocumentState(db, ws, node);
      return {
        body: readMarkdownBody(content),
        attachments,
        document_type: document.documentType
          ? {
              ...document.documentType,
              version: document.documentType.version ?? 1,
              created_at: document.documentType.created_at.toISOString(),
              updated_at: document.documentType.updated_at.toISOString()
            }
          : null,
        document_type_id: document.documentTypeId,
        metadata: document.metadata,
        generated_metadata: document.generatedMetadata,
        available_fields: document.availableFields,
        retired_fields: document.retiredFields,
        ...(document.documentType
          ? {
              workflow: await getDocumentWorkflowStatuses(
                db,
                ws,
                node.id,
                document.documentType,
                document.metadata
              )
            }
          : {})
      };
    }
  );
};

export const saveMarkdownContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  body: string,
  name: string | undefined,
  documentTypeId: string | null | undefined,
  metadata: DocumentMetadata | undefined,
  event: AuthenticatedEvent,
  external?: ExternalUpdateEnvelope,
  allowTypeMigration = false,
  changeKind: 'minor' | 'major' = 'minor'
): Promise<ProjectFile> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to save markdown content',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
      const currentDocument = await getDocumentState(db, ws, node);
      const nextDocumentTypeId =
        documentTypeId === undefined ? currentDocument.documentTypeId : documentTypeId;
      const rawNextMetadata = metadata ?? currentDocument.metadata;
      const nextDocumentType = nextDocumentTypeId
        ? await db.document.getDocumentType(ws, nextDocumentTypeId)
        : null;
      const resolvedMetadata = nextDocumentType
        ? await resolveDocumentMetadata(db, ws, nextDocumentType.fields, rawNextMetadata)
        : { values: rawNextMetadata, links: [] };
      const nextMetadata = resolvedMetadata.values;
      const typeChanged = currentDocument.documentTypeId !== (nextDocumentTypeId ?? null);
      httpAssert.true(!typeChanged || allowTypeMigration, {
        status: 409,
        message: 'Changing or removing a document type requires an explicit migration'
      });
      if (allowTypeMigration && typeChanged && nextDocumentTypeId === null) {
        httpAssert.true(Object.keys(nextMetadata).length === 0, {
          status: 409,
          message: 'Remove all metadata before removing the document type'
        });
      }
      if (nextDocumentTypeId) {
        httpAssert.present(nextDocumentType, {
          status: 400,
          message: `Document type '${nextDocumentTypeId}' not found`
        });
        httpAssert.true(
          !nextDocumentType.archived || currentDocument.documentTypeId === nextDocumentTypeId,
          {
            status: 409,
            message: `Archived document type '${nextDocumentTypeId}' cannot be selected for a new document`
          }
        );
        assertDocumentMetadataValid(
          nextDocumentType.fields,
          nextMetadata,
          true,
          allowTypeMigration && typeChanged
        );
      } else if (!allowTypeMigration || !typeChanged) {
        assertDocumentMetadataValid([], nextMetadata, true);
      }
      const documentFields = currentDocument.availableFields.concat(currentDocument.retiredFields);
      if (external) {
        requireWorkspaceCapability(
          authCtx,
          'ent.external_update',
          'You do not have permission to perform external updates on documents'
        );
        httpAssert.true(!typeChanged, {
          status: 400,
          message: 'External updates cannot change the document type'
        });
        const otherFields = assertValidExternalUpdateTarget(
          documentFields,
          external,
          currentDocument.metadata,
          nextMetadata
        );
        assertNoExternalFieldWrites(otherFields, currentDocument.metadata, nextMetadata);
      } else if (!typeChanged) {
        assertNoExternalDocumentFieldWrites(documentFields, currentDocument.metadata, nextMetadata);
      }
      const content = Buffer.from(JSON.stringify({ body }), 'utf8');
      const timestamp = new Date();
      const nextName = name?.trim() ? name.trim() : node.name;
      const previousContent = await storage.read(ws, storageScope(ws, node), node.id);
      const bodyChanged = readMarkdownBody(previousContent) !== body;
      const metadataChanged = !metadataEquals(currentDocument.metadata, nextMetadata);
      const effectiveChange = bodyChanged || metadataChanged;
      const nextGeneratedMetadata = external
        ? {
            ...currentDocument.generatedMetadata,
            [external.fieldId]: applyExternalFieldUpdate(external.fieldId, external, timestamp)
          }
        : effectiveChange
          ? outdateGeneratedMetadata(currentDocument.generatedMetadata)
          : currentDocument.generatedMetadata;
      let row!: ContentNodeDbResult;
      let revision: MarkdownRevisionDbResult | undefined;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'update-markdown',
        scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
        nodeIds: [node.id],
        storageChanges: bodyChanged
          ? [
              {
                type: 'write',
                workspace: ws,
                storageId: storageScope(ws, node),
                nodeId: node.id,
                content
              }
            ]
          : [],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: node.id,
            workspace: ws,
            project_id: node.project_id,
            entity_id: node.entity_id,
            parent_id: node.parent_id,
            path: node.path,
            name: nextName,
            type: 'markdown',
            size_bytes: content.length,
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: node.created_at,
            updated_at: timestamp,
            created_byIfNew: node.created_by,
            updated_by: authCtx.userId
          });
          revision = await createContentNodeRevision(
            tx,
            ws,
            node.id,
            body,
            nextName,
            authCtx.userId,
            timestamp,
            null,
            nextDocumentTypeId,
            nextMetadata,
            tx
          );
          const effectiveMetadata = await applyDocumentWorkflowSave(tx, {
            workspace: ws,
            nodeId: node.id,
            documentType: nextDocumentType,
            currentMetadata: currentDocument.metadata,
            nextMetadata,
            changeKind,
            isNew: false,
            initiatorUserId: authCtx.userId,
            sourceRevision: revision.revision_number
          });
          if (nextDocumentTypeId !== null || Object.keys(effectiveMetadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: node.id,
              document_type_id: nextDocumentTypeId ?? null,
              values: effectiveMetadata,
              generated_metadata: nextGeneratedMetadata,
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, node.id, resolvedMetadata.links);
          } else {
            await tx.document.deleteDocumentMetadata(ws, node.id);
          }
          if (!external && effectiveChange && nextDocumentType) {
            await scheduleMetadataGenerationForDocument(tx, {
              workspace: ws,
              nodeId: node.id,
              documentType: nextDocumentType,
              sourceRevision: revision.revision_number,
              scheduledByUserId: authCtx.userId,
              now: timestamp
            });
          }
        },
        afterCommit: [
          {
            name: 'audit',
            run: () =>
              writeAudit(db, {
                userId: authCtx.userId,
                workspace: ws,
                operation: 'update',
                entityType: 'content_node',
                entityId: row.id,
                entityName: row.name,
                changes: computeChanges(extractEntityFields(node), extractEntityFields(row)),
                metadata: {
                  path: row.path,
                  ...(revision
                    ? { revision_id: revision.id, revision_number: revision.revision_number }
                    : {}),
                  ...(external
                    ? {
                        external_kind: external.kind,
                        external_field_id: external.fieldId,
                        source: external.source,
                        status: external.status,
                        requestId: external.requestId ?? null,
                        explanation: external.explanation ?? null,
                        failureNotice: external.failureNotice ?? null
                      }
                    : {})
                }
              })
          }
        ]
      });
      return toApiProjectFile(row);
    }
  );
};

export const migrateMarkdownContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  body: string,
  name: string | undefined,
  documentTypeId: string | null,
  metadata: DocumentMetadata,
  event: AuthenticatedEvent,
  changeKind: 'minor' | 'major' = 'major'
): Promise<ProjectFile> =>
  saveMarkdownContent(
    db,
    storage,
    workspace,
    nodeId,
    body,
    name,
    documentTypeId,
    metadata,
    event,
    undefined,
    true,
    changeKind
  );

export const listMarkdownRevisions = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<MarkdownRevisionSummary[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve markdown revisions',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const revisions = await db.project.listMarkdownRevisions(ws, node.id);
      return revisions.map(toApiMarkdownRevisionSummary);
    }
  );
};

export const listMarkdownWorkflowHistory = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
) =>
  defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve document workflow history',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const document = await getDocumentState(db, ws, node);
      if (!document.documentType) return [];
      return listDocumentWorkflowHistory(db, ws, nodeId, document.documentType, event);
    }
  );

export const getMarkdownRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  revisionId: string,
  event: AuthenticatedEvent
): Promise<MarkdownRevisionDetail> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve markdown revision',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const revision = await db.project.getMarkdownRevision(ws, node.id, revisionId);
      httpAssert.present(revision, { status: 404, message: `Revision '${revisionId}' not found` });
      return toApiMarkdownRevisionDetail(revision);
    }
  );
};

export const restoreMarkdownRevision = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  revisionId: string,
  event: AuthenticatedEvent,
  changeKind: 'minor' | 'major' = 'major'
): Promise<ProjectFile> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to restore markdown revision',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
      const revision = await db.project.getMarkdownRevision(ws, node.id, revisionId);
      httpAssert.present(revision, { status: 404, message: `Revision '${revisionId}' not found` });
      const currentDocument = await getDocumentState(db, ws, node);
      const restoredType = revision.document_type_id
        ? await db.document.getDocumentType(ws, revision.document_type_id)
        : null;
      const resolvedMetadata = restoredType
        ? await resolveDocumentMetadata(db, ws, restoredType.fields, revision.metadata, 409)
        : { values: revision.metadata, links: [] };
      if (revision.document_type_id) {
        httpAssert.present(restoredType, {
          status: 409,
          message: 'This revision references an unavailable document type'
        });
        const validation = validateDocumentMetadata(restoredType.fields, resolvedMetadata.values);
        httpAssert.true(validation.errors.length === 0, {
          status: 409,
          message: `Revision requires metadata review: ${validation.errors.join('; ')}`
        });
      }
      const content = Buffer.from(JSON.stringify({ body: revision.body }), 'utf8');
      const timestamp = new Date();
      const nextName = revision.title?.trim() ? revision.title.trim() : node.name;
      const previousContent = await storage.read(ws, storageScope(ws, node), node.id);
      const effectiveChange =
        readMarkdownBody(previousContent) !== revision.body ||
        !metadataEquals(currentDocument.metadata, resolvedMetadata.values);
      let row!: ContentNodeDbResult;
      let restoredRevision: MarkdownRevisionDbResult | undefined;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'restore-markdown',
        scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
        nodeIds: [node.id],
        storageChanges: [
          {
            type: 'write',
            workspace: ws,
            storageId: storageScope(ws, node),
            nodeId: node.id,
            content
          }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: node.id,
            workspace: ws,
            project_id: node.project_id,
            entity_id: node.entity_id,
            parent_id: node.parent_id,
            path: node.path,
            name: nextName,
            type: 'markdown',
            size_bytes: content.length,
            comment_count: node.comment_count,
            unresolved_comment_count: node.unresolved_comment_count,
            created_atIfNew: node.created_at,
            updated_at: timestamp,
            created_byIfNew: node.created_by,
            updated_by: authCtx.userId
          });
          restoredRevision = await createContentNodeRevision(
            tx,
            ws,
            node.id,
            revision.body,
            nextName,
            authCtx.userId,
            timestamp,
            revision.id,
            revision.document_type_id,
            resolvedMetadata.values,
            tx
          );
          const effectiveMetadata = await applyDocumentWorkflowSave(tx, {
            workspace: ws,
            nodeId: node.id,
            documentType: restoredType,
            currentMetadata: currentDocument.metadata,
            nextMetadata: resolvedMetadata.values,
            changeKind,
            isNew: false,
            initiatorUserId: authCtx.userId,
            sourceRevision: restoredRevision.revision_number
          });
          if (revision.document_type_id || Object.keys(effectiveMetadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: node.id,
              document_type_id: revision.document_type_id,
              values: effectiveMetadata,
              generated_metadata: effectiveChange
                ? outdateGeneratedMetadata(currentDocument.generatedMetadata)
                : currentDocument.generatedMetadata,
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, node.id, resolvedMetadata.links);
          } else {
            await tx.document.deleteDocumentMetadata(ws, node.id);
          }
          if (effectiveChange && restoredType) {
            await scheduleMetadataGenerationForDocument(tx, {
              workspace: ws,
              nodeId: node.id,
              documentType: restoredType,
              sourceRevision: restoredRevision.revision_number,
              scheduledByUserId: authCtx.userId,
              now: timestamp
            });
          }
        },
        afterCommit: [
          {
            name: 'audit',
            run: () =>
              writeAudit(db, {
                userId: authCtx.userId,
                workspace: ws,
                operation: 'update',
                entityType: 'content_node',
                entityId: row.id,
                entityName: row.name,
                changes: computeChanges(extractEntityFields(node), extractEntityFields(row)),
                metadata: {
                  path: row.path,
                  ...(restoredRevision
                    ? {
                        revision_id: restoredRevision.id,
                        revision_number: restoredRevision.revision_number
                      }
                    : {}),
                  restored_from_revision_id: revision.id
                }
              })
          }
        ]
      });
      return toApiProjectFile(row);
    }
  );
};
