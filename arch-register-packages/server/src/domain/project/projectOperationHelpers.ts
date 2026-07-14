import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';

export const projectDbErrorMessages = {
  unique: 'A project with that name already exists in this workspace',
  foreign: 'Foreign key constraint violation'
} as const;

const normalizeContentMetadataText = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
};

const normalizeContentMetadataKeywords = (value: unknown) => {
  if (typeof value !== 'string') return [];
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const part of value.split(/[\n,]/)) {
    const normalized = part.trim();
    if (normalized === '' || seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(normalized);
  }

  return keywords;
};

const extractContentMetadataFromDiagram = (doc: SerializedDiagramDocument) => {
  const metadata = doc.props?.metadata;

  return {
    title: normalizeContentMetadataText(metadata?.title),
    description: normalizeContentMetadataText(metadata?.description),
    company: normalizeContentMetadataText(metadata?.company),
    category: normalizeContentMetadataText(metadata?.category),
    keywords: normalizeContentMetadataKeywords(metadata?.keywords)
  };
};

const hasContentMetadata = (metadata: ReturnType<typeof extractContentMetadataFromDiagram>) =>
  metadata.title !== null ||
  metadata.description !== null ||
  metadata.company !== null ||
  metadata.category !== null ||
  metadata.keywords.length > 0;

export const syncDiagramContentMetadata = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  doc: SerializedDiagramDocument,
  updatedAt: Date
) => {
  const metadata = extractContentMetadataFromDiagram(doc);
  if (!hasContentMetadata(metadata)) {
    await db.project.deleteContentMetadata(workspace, nodeId);
    return;
  }

  await db.project.upsertContentMetadata({
    workspace,
    node_id: nodeId,
    title: metadata.title,
    description: metadata.description,
    company: metadata.company,
    category: metadata.category,
    keywords: metadata.keywords,
    updated_at: updatedAt
  });
};

export const reloadContentNode = async (db: DatabaseAdapter, workspace: string, nodeId: string) => {
  const row = await db.project.getAnyContentNodeById(workspace, nodeId);
  httpAssert.present(row, { status: 404, message: `Content node '${nodeId}' not found` });
  return row;
};

export const listSiblingNodes = async (
  db: DatabaseAdapter,
  ws: string,
  node: Pick<ContentNodeDbResult, 'project_id' | 'entity_id'>
) => {
  if (node.project_id) return await db.project.listContentNodes(ws, node.project_id);
  if (node.entity_id) return await db.project.listEntityContentNodes(ws, node.entity_id);
  return await db.project.listWorkspaceContentNodes(ws);
};

export const storageScope = (
  ws: string,
  node: { project_id: string | null; entity_id: string | null }
) => node.project_id ?? node.entity_id ?? ws;

export const requireNonProjectContentAccess = (
  authCtx: AuthorizationContext,
  action: 'read' | 'edit'
) =>
  requireWorkspaceCapability(
    authCtx,
    action === 'read' ? 'content.view' : 'content.edit',
    `You do not have permission to ${action === 'read' ? 'view' : 'modify'} workspace content`
  );

export const assertContentPathWritable = (
  nodes: readonly Pick<ContentNodeDbResult, 'path' | 'mount_id'>[],
  path: string
) => {
  const mount = nodes.find(
    node => node.mount_id && (path === node.path || path.startsWith(`${node.path}/`))
  );
  httpAssert.true(!mount, {
    status: 403,
    message: 'Mounted external content is read-only'
  });
};

export const assertContentSubtreeWritable = (
  nodes: readonly Pick<ContentNodeDbResult, 'path' | 'mount_id'>[],
  path: string
) => {
  const mount = nodes.find(
    node =>
      node.mount_id &&
      (path === node.path ||
        path.startsWith(`${node.path}/`) ||
        node.path.startsWith(`${path}/`))
  );
  httpAssert.true(!mount, {
    status: 403,
    message: 'Mounted external content is read-only'
  });
};

export const assertContentNodeWritable = (
  node: Pick<ContentNodeDbResult, 'mount_id'>
) => {
  httpAssert.true(!node.mount_id, {
    status: 403,
    message: 'Mounted external content is read-only'
  });
};
