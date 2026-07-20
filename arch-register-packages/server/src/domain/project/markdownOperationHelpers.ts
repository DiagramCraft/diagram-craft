import type { DatabaseAdapter } from '../../db/database';

import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields } from '../audit/db/auditLogging';
import { isMarkdownPath } from './contentFileHelpers';
import {
  ATTACHMENT_CONTAINER_NAME,
  CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER,
  getAttachmentContainerForMarkdownNode
} from './contentNodeRoleUtils';

import type { ContentNodeDbResult, MarkdownRevisionDbResult } from './db/projectDatabase';

import { httpAssert } from '../../utils/httpAssert';

import type {
  MarkdownRevisionDetail,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectContract';

import type {
  DocumentGeneratedMetadata,
  DocumentMetadata
} from '@arch-register/api-types/documentContract';

import { documentLinksFromMetadata } from '../document/documentValidation';
import { outdateExternalMetadata } from '../externalMetadata/externalMetadataHelpers';

import {
  listSiblingNodes,
  requireNonProjectContentAccess,
  assertContentNodeWritable
} from './projectOperationHelpers';

export const toApiMarkdownRevisionSummary = (
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

export const toApiMarkdownRevisionDetail = (
  revision: MarkdownRevisionDbResult
): MarkdownRevisionDetail => ({
  ...toApiMarkdownRevisionSummary(revision),
  body: revision.body
});

export const createContentNodeRevision = async (
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

export const getDocumentState = async (
  db: DatabaseAdapter,
  ws: string,
  node: ContentNodeDbResult
) => {
  if (!db.document) {
    return {
      documentType: null,
      documentTypeId: null,
      metadata: {},
      generatedMetadata: {},
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
    generatedMetadata: metadata?.generated_metadata ?? {},
    availableFields: fields.filter(field => !field.retired),
    retiredFields: fields.filter(field => field.retired)
  };
};

export const metadataValueEquals = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }
  return a === b;
};

export const metadataEquals = (a: DocumentMetadata, b: DocumentMetadata): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!metadataValueEquals(a[key] ?? null, b[key] ?? null)) return false;
  }
  return true;
};

// Thin alias kept for call-site continuity; the actual logic is shared with entities.
export const outdateGeneratedMetadata = (
  generatedMetadata: DocumentGeneratedMetadata
): DocumentGeneratedMetadata => outdateExternalMetadata(generatedMetadata);

export const resolveDocumentMetadata = async (
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

export const getAttachmentContainerPath = (markdownPath: string) =>
  `${markdownPath.endsWith('.md') ? markdownPath.slice(0, -3) : markdownPath}/${ATTACHMENT_CONTAINER_NAME}`;

export const ensureMarkdownAttachmentContainer = async (
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

export const requireMarkdownNodeAccess = async (
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

export const isMarkdownNode = (node: Pick<ContentNodeDbResult, 'type' | 'path' | 'mount_id'>) =>
  node.type === 'markdown' ||
  (node.type === 'file' && node.mount_id != null && isMarkdownPath(node.path));

export const readMarkdownBody = (content: Buffer) => {
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
