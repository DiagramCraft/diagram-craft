import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import {
  logAudit,
  writeAudit,
  extractEntityFields,
  computeChanges
} from '../audit/db/auditLogging';
import { fileNameFromPath } from './contentFileHelpers';
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
  restored_from_revision_id: revision.restored_from_revision_id
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
  restoredFromRevisionId?: string | null
) => {
  const revisionNumber = await db.project.getNextMarkdownRevisionNumber(ws, nodeId);
  return await db.project.createMarkdownRevision({
    workspace: ws,
    node_id: nodeId,
    revision_number: revisionNumber,
    title,
    body,
    created_at: createdAt,
    created_by: createdBy,
    restored_from_revision_id: restoredFromRevisionId ?? null
  });
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
      httpAssert.true(node.type === 'markdown', {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const siblingNodes = await listSiblingNodes(db, ws, node);
      const attachments = getMarkdownAttachmentNodes(siblingNodes, node.id).map(toApiProjectFile);
      const content = await storage.read(ws, storageScope(ws, node), node.id);
      return { body: readMarkdownBody(content), attachments };
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
      httpAssert.true(markdownNode.type === 'markdown', {
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
      httpAssert.true(markdownNode.type === 'markdown', {
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
  event: AuthenticatedEvent
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
      httpAssert.true(node.type === 'markdown', {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
      const content = Buffer.from(JSON.stringify({ body }), 'utf8');
      const timestamp = new Date();
      const nextName = name?.trim() ? name.trim() : node.name;
      let row!: ContentNodeDbResult;
      let revision: MarkdownRevisionDbResult | undefined;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'update-markdown',
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
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: node.created_at,
            updated_at: timestamp,
            created_byIfNew: node.created_by,
            updated_by: authCtx.userId
          });
        },
        afterCommit: [
          {
            name: 'revision',
            run: async () => {
              revision = await createContentNodeRevision(
                db,
                ws,
                node.id,
                body,
                nextName,
                authCtx.userId,
                timestamp
              );
            }
          },
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
      httpAssert.true(node.type === 'markdown', {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
      const revisions = await db.project.listMarkdownRevisions(ws, node.id);
      return revisions.map(toApiMarkdownRevisionSummary);
    }
  );
};

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
      httpAssert.true(node.type === 'markdown', {
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
      httpAssert.true(node.type === 'markdown', {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
      const revision = await db.project.getMarkdownRevision(ws, node.id, revisionId);
      httpAssert.present(revision, { status: 404, message: `Revision '${revisionId}' not found` });

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
        },
        afterCommit: [
          {
            name: 'revision',
            run: async () => {
              restoredRevision = await createContentNodeRevision(
                db,
                ws,
                node.id,
                revision.body,
                nextName,
                authCtx.userId,
                timestamp,
                revision.id
              );
            }
          },
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
