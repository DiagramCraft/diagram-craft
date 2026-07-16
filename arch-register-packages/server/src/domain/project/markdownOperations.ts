import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import {
  logAudit,
  writeAudit,
  extractEntityFields,
  computeChanges
} from '../audit/db/auditLogging';
import { fileNameFromPath, isMarkdownPath } from './contentFileHelpers';
import {
  ATTACHMENT_CONTAINER_NAME,
  CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER,
  getAttachmentContainerForMarkdownNode,
  getMarkdownAttachmentNodes
} from './contentNodeRoleUtils';
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
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import {
  assertDocumentMetadataValid,
  documentLinksFromMetadata,
  validateDocumentMetadata
} from '../document/documentValidation';
import { coordinateContentWrite } from './contentWriteCoordinator';
import {
  listSiblingNodes,
  projectDbErrorMessages,
  requireNonProjectContentAccess,
  storageScope,
  assertContentPathWritable,
  assertContentNodeWritable
} from './projectOperationHelpers';

const toApiMarkdownRevisionSummary = (
  revision: MarkdownRevisionDbResult
): MarkdownRevisionSummary => ({
  id: revision.id,
  revision_number: revision.revision_number,
  title: revision.title,
  created_at: revision.created_at.toISOString(),
  created_by: revision.created_by,
  created_by_name: revision.created_by_name,
  restored_from_revision_id: revision.restored_from_revision_id,
  document_type_id: revision.document_type_id,
  metadata: revision.metadata
});

const toApiMarkdownRevisionDetail = (
  revision: MarkdownRevisionDbResult
): MarkdownRevisionDetail => ({
  ...toApiMarkdownRevisionSummary(revision),
  body: revision.body
});

const createContentNodeRevision = async (
  db: DatabaseAdapter,
  ws: string,
  nodeId: string,
  body: string,
  title: string | null,
  createdBy: string | null,
  createdAt: Date,
  restoredFromRevisionId?: string | null,
  documentTypeId?: string | null,
  metadata?: DocumentMetadata,
  revisionDb: DatabaseAdapter = db
) => {
  const revisionNumber = await revisionDb.project.getNextMarkdownRevisionNumber(ws, nodeId);
  return await revisionDb.project.createMarkdownRevision({
    workspace: ws,
    node_id: nodeId,
    revision_number: revisionNumber,
    title,
    body,
    created_at: createdAt,
    created_by: createdBy,
    restored_from_revision_id: restoredFromRevisionId ?? null,
    document_type_id: documentTypeId ?? null,
    metadata: metadata ?? {}
  });
};

const getDocumentState = async (db: DatabaseAdapter, ws: string, node: ContentNodeDbResult) => {
  if (!db.document) {
    return {
      documentType: null,
      documentTypeId: null,
      metadata: {},
      availableFields: [],
      retiredFields: []
    };
  }
  const metadata = await db.document.getDocumentMetadata(ws, node.id);
  const documentType = metadata?.document_type_id
    ? await db.document.getDocumentType(ws, metadata.document_type_id)
    : null;
  const fields = documentType?.fields ?? [];
  return {
    documentType,
    documentTypeId: metadata?.document_type_id ?? null,
    metadata: metadata?.values ?? {},
    availableFields: fields.filter(field => !field.retired),
    retiredFields: fields.filter(field => field.retired)
  };
};

const resolveDocumentMetadata = async (
  db: DatabaseAdapter,
  ws: string,
  fields: Parameters<typeof documentLinksFromMetadata>[0],
  metadata: DocumentMetadata,
  status: 400 | 409 = 400
) => {
  const values = { ...metadata };
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const raw = metadata[field.id];
    const targetIds = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const resolvedIds = await Promise.all(
      targetIds.map(async targetId => {
        if (field.type === 'entity_link') {
          const entity = await db.catalog.getEntity(ws, targetId);
          httpAssert.present(entity, {
            status,
            message: `Linked entity '${targetId}' was not found`
          });
          return entity.id;
        }
        const target = await db.project.getAnyContentNodeById(ws, targetId);
        httpAssert.present(target, {
          status,
          message: `Linked document '${targetId}' was not found`
        });
        httpAssert.true(isMarkdownNode(target), {
          status,
          message: `Linked document '${targetId}' is not Markdown`
        });
        return target.id;
      })
    );
    if (Array.isArray(raw)) values[field.id] = resolvedIds;
    else if (typeof raw === 'string') values[field.id] = resolvedIds[0] ?? null;
  }
  return { values, links: documentLinksFromMetadata(fields, values) };
};

const getAttachmentContainerPath = (markdownPath: string) =>
  `${markdownPath.endsWith('.md') ? markdownPath.slice(0, -3) : markdownPath}/${ATTACHMENT_CONTAINER_NAME}`;

const ensureMarkdownAttachmentContainer = async (
  db: DatabaseAdapter,
  ws: string,
  markdownNode: ContentNodeDbResult,
  authCtx: Awaited<ReturnType<typeof buildApiAuthCtx>>,
  timestamp: Date
) => {
  const siblingNodes = await listSiblingNodes(db, ws, markdownNode);
  const existingContainer = getAttachmentContainerForMarkdownNode(siblingNodes, markdownNode.id);
  if (existingContainer) return existingContainer;

  const containerPath = getAttachmentContainerPath(markdownNode.path);
  const createdContainer = await db.project.createContentNodeIfAbsent({
    workspace: ws,
    project_id: markdownNode.project_id,
    entity_id: markdownNode.entity_id,
    parent_id: markdownNode.id,
    path: containerPath,
    name: ATTACHMENT_CONTAINER_NAME,
    role: CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER,
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    created_atIfNew: timestamp,
    updated_at: timestamp,
    created_byIfNew: authCtx.userId,
    updated_by: authCtx.userId
  });

  if (createdContainer) {
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: createdContainer.id,
      entityName: createdContainer.name,
      changes: { new: extractEntityFields(createdContainer) },
      metadata: {
        path: createdContainer.path,
        parent_markdown_node_id: markdownNode.id,
        role: CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER
      }
    });
    return createdContainer;
  }

  const nextSiblingNodes = await listSiblingNodes(db, ws, markdownNode);
  const container = getAttachmentContainerForMarkdownNode(nextSiblingNodes, markdownNode.id);
  httpAssert.present(container, {
    status: 500,
    message: `Attachment container for markdown document '${markdownNode.id}' could not be created`
  });
  return container;
};

const requireMarkdownNodeAccess = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: Awaited<ReturnType<typeof buildApiAuthCtx>>,
  node: { project_id: string | null; mount_id?: string | null },
  action: 'read' | 'edit'
) => {
  if (action === 'edit') assertContentNodeWritable(node);
  if (!node.project_id) {
    requireNonProjectContentAccess(authCtx, action);
    return;
  }

  const project = await db.project.getProject(ws, node.project_id);
  httpAssert.present(project, { status: 404, message: `Project '${node.project_id}' not found` });

  if (action === 'read') {
    requireProjectAccess(authCtx, project.owner);
    return;
  }

  requireProjectAction(
    authCtx,
    project.owner,
    'edit_project',
    'You do not have permission to modify this project'
  );
};

// ── Markdown document operations ──────────────────────────────

const EMPTY_MARKDOWN_BODY = JSON.stringify({ body: '' });

const isMarkdownNode = (node: Pick<ContentNodeDbResult, 'type' | 'path' | 'mount_id'>) =>
  node.type === 'markdown' ||
  (node.type === 'file' && node.mount_id != null && isMarkdownPath(node.path));

const readMarkdownBody = (content: Buffer) => {
  const rawContent = content.toString('utf8');

  try {
    const parsed = JSON.parse(rawContent) as { body?: unknown };
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.body === 'string') {
      return parsed.body;
    }
  } catch {
    // External markdown mounts may contain the source file directly. Keep
    // accepting that representation so existing mounts remain readable.
  }

  return rawContent;
};

const metadataFingerprint = (metadata: DocumentMetadata) =>
  JSON.stringify(Object.entries(metadata).sort(([left], [right]) => left.localeCompare(right)));

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
      if (documentType) assertDocumentMetadataValid(documentType.fields, resolvedMetadata.values);
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
          if (input.document_type_id || Object.keys(input.metadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: nodeId,
              document_type_id: input.document_type_id ?? null,
              values: resolvedMetadata.values,
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, nodeId, resolvedMetadata.links);
          }
          await createContentNodeRevision(
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
              created_at: document.documentType.created_at.toISOString(),
              updated_at: document.documentType.updated_at.toISOString()
            }
          : null,
        document_type_id: document.documentTypeId,
        metadata: document.metadata,
        available_fields: document.availableFields,
        retired_fields: document.retiredFields
      };
    }
  );
};

export const uploadMarkdownAttachment = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to upload markdown attachment',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const fileName = fileNameFromPath(filePath) || originalFilename;
      const markdownNode = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(markdownNode, {
        status: 404,
        message: `Markdown document '${nodeId}' not found`
      });
      httpAssert.true(isMarkdownNode(markdownNode), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, markdownNode, 'edit');

      const timestamp = new Date();
      const container = await ensureMarkdownAttachmentContainer(
        db,
        ws,
        markdownNode,
        authCtx,
        timestamp
      );
      const attachmentPath = `${container.path}/${fileName}`;
      const siblingNodes = await listSiblingNodes(db, ws, markdownNode);
      const existingFile =
        getMarkdownAttachmentNodes(siblingNodes, markdownNode.id).find(
          node => node.path === attachmentPath && node.type === 'file'
        ) ?? null;
      const isUpdate = existingFile !== null;

      const attachmentId = existingFile?.id ?? randomUUID();
      let row!: ContentNodeDbResult;
      await coordinateContentWrite({
        db,
        storage,
        operation: isUpdate ? 'update-attachment' : 'create-attachment',
        scope: markdownNode.project_id
          ? 'project'
          : markdownNode.entity_id
            ? 'entity'
            : 'workspace',
        nodeIds: [attachmentId],
        storageChanges: [
          {
            type: 'write',
            workspace: ws,
            storageId: storageScope(ws, markdownNode),
            nodeId: attachmentId,
            content: buffer
          }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: attachmentId,
            workspace: ws,
            project_id: markdownNode.project_id,
            entity_id: markdownNode.entity_id,
            parent_id: container.id,
            path: attachmentPath,
            name: originalFilename,
            type: 'file',
            size_bytes: buffer.length,
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: existingFile?.created_at ?? timestamp,
            updated_at: timestamp,
            created_byIfNew: existingFile?.created_by ?? authCtx.userId,
            updated_by: authCtx.userId,
            mime_type: mimeType,
            original_filename: originalFilename
          });
        },
        afterCommit: [
          {
            name: 'audit',
            run: () =>
              writeAudit(db, {
                userId: authCtx.userId,
                workspace: ws,
                operation: isUpdate ? 'update' : 'create',
                entityType: 'content_node',
                entityId: attachmentId,
                entityName: row.name,
                changes: isUpdate
                  ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row))
                  : { new: extractEntityFields(row) },
                metadata: {
                  path: attachmentPath,
                  parent_markdown_node_id: markdownNode.id,
                  is_attachment: true
                }
              })
          }
        ]
      });

      return toApiProjectFile(row);
    }
  );
};

export const createMarkdownDiagramAttachment = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  name: string,
  content: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create diagram attachment',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const markdownNode = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(markdownNode, {
        status: 404,
        message: `Markdown document '${nodeId}' not found`
      });
      httpAssert.true(isMarkdownNode(markdownNode), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, markdownNode, 'edit');

      const timestamp = new Date();
      const container = await ensureMarkdownAttachmentContainer(
        db,
        ws,
        markdownNode,
        authCtx,
        timestamp
      );

      const siblingNodes = await listSiblingNodes(db, ws, markdownNode);
      const existingDiagrams = getMarkdownAttachmentNodes(siblingNodes, markdownNode.id).filter(
        n => n.type === 'diagram'
      );

      let diagramName = name;
      let counter = 2;
      while (existingDiagrams.some(n => n.path === `${container.path}/${diagramName}.json`)) {
        diagramName = `${name} ${counter++}`;
      }
      const diagramPath = `${container.path}/${diagramName}.json`;

      const buffer = Buffer.from(JSON.stringify(content));
      const attachmentId = randomUUID();
      let row!: ContentNodeDbResult;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'create-diagram-attachment',
        scope: markdownNode.project_id
          ? 'project'
          : markdownNode.entity_id
            ? 'entity'
            : 'workspace',
        nodeIds: [attachmentId],
        storageChanges: [
          {
            type: 'write',
            workspace: ws,
            storageId: storageScope(ws, markdownNode),
            nodeId: attachmentId,
            content: buffer
          }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: attachmentId,
            workspace: ws,
            project_id: markdownNode.project_id,
            entity_id: markdownNode.entity_id,
            parent_id: container.id,
            path: diagramPath,
            name: diagramName,
            type: 'diagram',
            size_bytes: buffer.length,
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
                entityId: attachmentId,
                entityName: row.name,
                changes: { new: extractEntityFields(row) },
                metadata: {
                  path: diagramPath,
                  parent_markdown_node_id: markdownNode.id,
                  is_attachment: true
                }
              })
          }
        ]
      });

      return toApiProjectFile(row);
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
  allowTypeMigration = false
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
          allowTypeMigration && typeChanged
        );
      }
      const content = Buffer.from(JSON.stringify({ body }), 'utf8');
      const timestamp = new Date();
      const nextName = name?.trim() ? name.trim() : node.name;
      const previousContent = await storage.read(ws, storageScope(ws, node), node.id);
      const stateChanged =
        readMarkdownBody(previousContent) !== body ||
        node.name !== nextName ||
        currentDocument.documentTypeId !== (nextDocumentTypeId ?? null) ||
        metadataFingerprint(currentDocument.metadata) !== metadataFingerprint(nextMetadata);
      if (!stateChanged) return toApiProjectFile(node);
      let row!: ContentNodeDbResult;
      let revision: MarkdownRevisionDbResult | undefined;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'update-markdown',
        scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
        nodeIds: [node.id],
        storageChanges:
          readMarkdownBody(previousContent) === body
            ? []
            : [
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
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: node.created_at,
            updated_at: timestamp,
            created_byIfNew: node.created_by,
            updated_by: authCtx.userId
          });
          if (nextDocumentTypeId !== null || Object.keys(nextMetadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: node.id,
              document_type_id: nextDocumentTypeId ?? null,
              values: nextMetadata,
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, node.id, resolvedMetadata.links);
          } else {
            await tx.document.deleteDocumentMetadata(ws, node.id);
          }
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
  event: AuthenticatedEvent
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
    true
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

export const listRelatedContent = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve related content', dbErrorMessages: projectDbErrorMessages },
    async ({ ws, authCtx }) => {
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
      const links = await db.document.listDocumentsLinkingEntity(ws, entity.id);
      const result: Array<{
        file: ProjectFile;
        scope: 'project' | 'entity' | 'workspace';
        document_type_id: string | null;
        document_type_name: string | null;
        document_type_color: string | null;
        document_type_icon: string | null;
        field_id: string;
        field_name: string;
      }> = [];
      const seen = new Set<string>();
      for (const link of links) {
        const node = await db.project.getAnyContentNodeById(ws, link.node_id);
        if (!node || !isMarkdownNode(node)) continue;
        try {
          await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
        } catch {
          continue;
        }
        const state = await getDocumentState(db, ws, node);
        const field = state.documentType?.fields.find(item => item.id === link.field_id);
        const key = `${node.id}:${link.field_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          file: toApiProjectFile(node),
          scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
          document_type_id: state.documentTypeId,
          document_type_name: state.documentType?.name ?? null,
          document_type_color: state.documentType?.color ?? null,
          document_type_icon: state.documentType?.icon ?? null,
          field_id: link.field_id,
          field_name: field?.name ?? link.field_id
        });
      }
      return result;
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
  event: AuthenticatedEvent
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
          if (revision.document_type_id || Object.keys(revision.metadata).length > 0) {
            await tx.document.upsertDocumentMetadata({
              workspace: ws,
              node_id: node.id,
              document_type_id: revision.document_type_id,
              values: resolvedMetadata.values,
              updated_at: timestamp
            });
            await tx.document.replaceDocumentLinks(ws, node.id, resolvedMetadata.links);
          } else {
            await tx.document.deleteDocumentMetadata(ws, node.id);
          }
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

// ── Binary file upload / download ─────────────────────────────
