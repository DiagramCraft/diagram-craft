import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { getDiagramCommentCounts } from '../diagram/commentCounts';
import { getDiagramEntityRefs } from '../diagram/diagramEntityRefs';
import {
  buildApiAuthCtx,
  canAccessProject,
  requireCanCreateProject,
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceAdmin
} from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { fileNameFromPath, displayNameFromBody, folderFromPath, stripJsonExtension } from './contentFileHelpers';
import {
  collectDescendantNodes,
  collectHiddenAttachmentNodeIds,
  getAttachmentContainerForMarkdownNode,
  getMarkdownAttachmentNodes
} from './contentNodeRoleUtils';
import {
  toApiProject,
  toApiProjectFile,
  toApiProjectDetail,
  toApiProjectEntity
} from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { HTTPError } from 'h3';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import {
  DiagramEntityFile,
  FileTree,
  MarkdownContent,
  MarkdownRevisionDetail,
  MarkdownRevisionSummary,
  Project,
  ProjectDetail,
  ProjectEntity,
  ProjectFile
} from '@arch-register/api-types/projectContract';
import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { formatPublicId } from '../../utils/publicIds';
import type { MarkdownRevisionDbResult } from './db/projectDatabase';

const PROJECT_STATUSES = ['draft', 'active', 'complete', 'cancelled'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A project with that name already exists in this workspace',
    foreign: 'Foreign key constraint violation'
  });

const parseProjectStatus = (value: unknown): ProjectStatus => {
  if (value == null || value === '') return 'active';
  if (typeof value !== 'string' || !PROJECT_STATUSES.includes(value as ProjectStatus)) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`
    });
  }
  return value as ProjectStatus;
};

const resolveProjectOwner = (owner: unknown, teamIds: Set<string>) =>
  typeof owner === 'string' && teamIds.has(owner) ? owner : null;

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

const syncDiagramContentMetadata = async (
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

const reloadContentNode = async (db: DatabaseAdapter, workspace: string, nodeId: string) => {
  const row = await db.project.getAnyContentNodeById(workspace, nodeId);
  httpAssert.present(row, { status: 404, message: `Content node '${nodeId}' not found` });
  return row;
};

export const buildFileTree = (files: ContentNodeDbResult[]): FileTree => {
  const hiddenAttachmentNodeIds = collectHiddenAttachmentNodeIds(files);
  const visibleFiles = files.filter(file => !hiddenAttachmentNodeIds.has(file.id));
  const folderNodes = visibleFiles.filter(f => f.type === 'folder');
  const nonFolderNodes = visibleFiles.filter(f => f.type !== 'folder');

  const rootFiles = nonFolderNodes.filter(f => f.parent_id === null).map(toApiProjectFile);

  const folders = folderNodes
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(folder => ({
      path: folder.path,
      name: folder.name,
      files: nonFolderNodes.filter(f => f.parent_id === folder.id).map(toApiProjectFile)
    }));

  return { folders, rootFiles };
};

const getNodeExtension = (node: Pick<ContentNodeDbResult, 'type'>) => {
  switch (node.type) {
    case 'markdown':
      return '.md';
    case 'file':
      return '';
    default:
      return '.json';
  }
};

const getDisplayNameForPath = (
  node: Pick<ContentNodeDbResult, 'type'>,
  path: string
) => {
  const fileName = fileNameFromPath(path);
  if (node.type === 'file') return fileName;
  if (node.type === 'markdown' && fileName.endsWith('.md')) return fileName.slice(0, -3);
  if (fileName.endsWith('.json')) return fileName.slice(0, -5);
  return fileName;
};

const listSiblingNodes = async (
  db: DatabaseAdapter,
  ws: string,
  node: Pick<ContentNodeDbResult, 'project_id' | 'entity_id'>
) => {
  if (node.project_id) return await db.project.listContentNodes(ws, node.project_id);
  if (node.entity_id) return await db.project.listEntityContentNodes(ws, node.entity_id);
  return await db.project.listWorkspaceContentNodes(ws);
};

const buildRelocatedAttachmentPath = (
  previousRootPath: string,
  nextRootPath: string,
  currentPath: string
) => {
  if (currentPath === previousRootPath) return nextRootPath;
  const suffix = currentPath.startsWith(`${previousRootPath}/`)
    ? currentPath.slice(previousRootPath.length + 1)
    : currentPath;
  return `${nextRootPath}/${suffix}`;
};

const cloneMarkdownAttachmentSubtree = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  ws: string,
  storageId: string,
  sourceMarkdownNode: ContentNodeDbResult,
  targetMarkdownNode: ContentNodeDbResult,
  siblingNodes: readonly ContentNodeDbResult[],
  authCtx: { userId: string | null },
  timestamp: Date
) => {
  const container = getAttachmentContainerForMarkdownNode(siblingNodes, sourceMarkdownNode.id);
  if (!container) return;

  const descendants = collectDescendantNodes(siblingNodes, container.id);
  const previousRootPath = sourceMarkdownNode.path.endsWith('.md')
    ? sourceMarkdownNode.path.slice(0, -3)
    : sourceMarkdownNode.path;
  const nextRootPath = targetMarkdownNode.path.endsWith('.md')
    ? targetMarkdownNode.path.slice(0, -3)
    : targetMarkdownNode.path;

  const createdByOldId = new Map<string, ContentNodeDbResult>();
  createdByOldId.set(sourceMarkdownNode.id, targetMarkdownNode);

  const sourceNodes = [container, ...descendants];
  for (const sourceNode of sourceNodes) {
    const newPath = buildRelocatedAttachmentPath(previousRootPath, nextRootPath, sourceNode.path);
    const parentId =
      sourceNode.parent_id === sourceMarkdownNode.id
        ? targetMarkdownNode.id
        : createdByOldId.get(sourceNode.parent_id ?? '')?.id ?? null;

    const createdNode = await db.project.upsertContentNode({
      workspace: ws,
      project_id: targetMarkdownNode.project_id,
      entity_id: targetMarkdownNode.entity_id,
      parent_id: parentId,
      path: newPath,
      name: sourceNode.name,
      role: sourceNode.role,
      type: sourceNode.type,
      size_bytes: sourceNode.size_bytes,
      comment_count: sourceNode.comment_count,
      unresolved_comment_count: sourceNode.unresolved_comment_count,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId,
      mime_type: sourceNode.mime_type,
      original_filename: sourceNode.original_filename
    });
    createdByOldId.set(sourceNode.id, createdNode);

    if (sourceNode.type !== 'folder') {
      const content = await storage.read(ws, storageId, sourceNode.id);
      await storage.write(ws, storageId, createdNode.id, content);
    }
  }
};

const deleteMarkdownAttachmentSubtree = async (
  storage: StorageAdapter,
  ws: string,
  storageId: string,
  siblingNodes: readonly ContentNodeDbResult[],
  markdownNodeId: string
) => {
  const container = getAttachmentContainerForMarkdownNode(siblingNodes, markdownNodeId);
  if (!container) return;

  const subtree = [container, ...collectDescendantNodes(siblingNodes, container.id)];
  await Promise.all(
    subtree
      .filter(node => node.type !== 'folder')
      .map(node => storage.delete(ws, storageId, node.id).catch(() => {}))
  );
};

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

export const listProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<Project[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const projects = await db.project.listProjects(ws);
    const visibleProjects = projects.filter(project => canAccessProject(authCtx, project.owner));
    const fileCounts = new Map<string, number>();
    const projectFiles = await Promise.all(
      visibleProjects.map(project => db.project.listContentNodes(ws, project.id))
    );
    for (const files of projectFiles) {
      for (const file of files) {
        if (file.type === 'diagram' && file.project_id != null) {
          fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
        }
      }
    }
    return visibleProjects
      .map(project => toApiProject(project, fileCounts.get(project.id) ?? 0, authCtx))
      .sort((a, b) => {
        const pinnedRank = (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
        if (pinnedRank !== 0) return pinnedRank;
        const rank = { draft: 0, active: 1, complete: 2, cancelled: 3 } as const;
        return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
      });
  } catch (e) {
    return handleError(e, 'Failed to retrieve projects');
  }
};

export const getProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<ProjectDetail> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const files = await db.project.listContentNodes(ws, project.id);
    return toApiProjectDetail(project, buildFileTree(files), authCtx);
  } catch (e) {
    return handleError(e, 'Failed to retrieve project');
  }
};

export const createProject = async (
  db: DatabaseAdapter,
  workspace: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'draft' | 'active' | 'complete' | 'cancelled';
    color?: string | null;
    target_date?: string | null;
    pinned?: boolean;
  },
  event: AuthenticatedEvent
): Promise<Project> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const teamIds = new Set((await db.workspace.listTeams(ws)).map(row => row.id));
    const timestamp = new Date();
    const workspaceRow = await db.workspace.getWorkspace(ws);
    httpAssert.present(workspaceRow, { status: 404, message: `Workspace '${ws}' not found` });

    httpAssert.present(input.name, { message: 'name is required' });

    const publicId = formatPublicId(
      workspaceRow.short_code,
      await db.workspace.allocatePublicId(workspaceRow.short_code, timestamp)
    );

    const createInput = {
      id: randomUUID(),
      workspace: ws,
      public_id: publicId,
      name: input.name,
      description: input.description ?? '',
      owner: resolveProjectOwner(input.owner, teamIds),
      status: parseProjectStatus(input.status),
      color: typeof input.color === 'string' ? input.color : null,
      target_date: typeof input.target_date === 'string' ? input.target_date : null,
      pinned: input.pinned ?? false,
      created_at: timestamp,
      updated_at: timestamp
    };

    requireCanCreateProject(
      authCtx,
      createInput.owner,
      'You do not have permission to create a project for this owner team'
    );

    const row = await db.project.createProject(createInput);

    await logAudit(db, {
      userId: authCtx?.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'project',
      entityId: row.id,
      entityName: row.name,
      changes: { new: extractEntityFields(row) }
    });

    return toApiProject(row, 0, authCtx);
  } catch (e) {
    return handleError(e, 'Failed to create project');
  }
};

export const updateProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'draft' | 'active' | 'complete' | 'cancelled';
    color?: string | null;
    target_date?: string | null;
    pinned?: boolean;
  },
  event: AuthenticatedEvent
): Promise<Project> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const oldRow = await db.project.getProject(ws, id);
    httpAssert.present(oldRow, { status: 404, message: `Project '${id}' not found` });
    const teamIds = new Set((await db.workspace.listTeams(ws)).map(row => row.id));

    httpAssert.present(input.name, { message: 'name is required' });
    const projectStatus = input.status === undefined ? undefined : parseProjectStatus(input.status);
    const newOwner =
      input.owner !== undefined ? resolveProjectOwner(input.owner, teamIds) : oldRow.owner;

    const updateInput = {
      name: input.name,
      description:
        input.description !== undefined
          ? typeof input.description === 'string'
            ? input.description
            : ''
          : oldRow.description,
      owner: newOwner,
      status: projectStatus ?? oldRow.status,
      color:
        input.color !== undefined
          ? typeof input.color === 'string'
            ? input.color
            : null
          : oldRow.color,
      target_date:
        input.target_date !== undefined
          ? typeof input.target_date === 'string'
            ? input.target_date
            : null
          : oldRow.target_date,
      pinned: input.pinned !== undefined ? input.pinned : oldRow.pinned,
      updated_at: new Date()
    };

    requireProjectAction(
      authCtx,
      oldRow.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    if (newOwner !== oldRow.owner) {
      requireProjectAction(
        authCtx,
        newOwner,
        'edit_project',
        'You do not have permission to transfer this project to the target owner team'
      );
    }

    const row = await db.project.updateProject(ws, oldRow.id, updateInput);
    httpAssert.present(row, { status: 404, message: `Project '${id}' not found` });

    const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'project',
      entityId: oldRow.id,
      entityName: row.name,
      changes
    });

    const fileCount = (await db.project.listContentNodes(ws, oldRow.id)).length;
    return toApiProject(row, fileCount, authCtx);
  } catch (e) {
    return handleError(e, 'Failed to update project');
  }
};

export const deleteProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });

    requireProjectAction(
      authCtx,
      project.owner,
      'delete_project',
      'You do not have permission to delete this project'
    );

    await db.project.deleteProject(ws, project.id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'project',
      entityId: project.id,
      entityName: project.name,
      changes: { old: extractEntityFields(project) }
    });

    if (storage) {
      await storage.deleteAll(ws, project.id).catch(() => {});
    }

    return { success: true, message: `Project '${project.id}' deleted` };
  } catch (e) {
    return handleError(e, 'Failed to delete project');
  }
};

export const listProjectFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const files = await db.project.listContentNodes(ws, project.id);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to list files');
  }
};

export const createFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, project.id, parentPath);
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: project.id,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { project_id: project.id, path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create folder');
  }
};

export const createEntityFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      // For entity content, find parent by querying entity content nodes
      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const parentFolder = entityNodes.find(n => n.path === parentPath && n.type === 'folder');
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { entity_id: entityUuid, path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create entity folder');
  }
};

export const createEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const content = Buffer.from(JSON.stringify(body), 'utf8');
  const displayName = displayNameFromBody(body, filePath);

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const existingFile = await db.project.listEntityContentNodes(ws, entityUuid).then(nodes =>
      nodes.find(n => n.path === filePath && n.type === 'diagram')
    );
    const isUpdate = !!existingFile;

    let fileParentId: string | null = null;
    const folderPath = folderFromPath(filePath);
    if (folderPath) {
      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const parentFolder = entityNodes.find(n => n.path === folderPath && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const doc = body as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: fileParentId,
      path: filePath,
      name: String(displayName),
      size_bytes: content.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile?.created_at ?? timestamp,
      updated_at: timestamp,
      created_byIfNew: existingFile?.created_by ?? authCtx.userId,
      updated_by: authCtx.userId
    });

    await storage.write(ws, entityUuid, row.id, content);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        ws,
        entityUuid,
        row.id,
        content.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );
    } catch {
      await db.project.updateContentNodeDerivedData(
        ws,
        entityUuid,
        row.id,
        content.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        null,
        timestamp
      );
    }

    const entityRefs = getDiagramEntityRefs(doc);
    await db.project.syncDiagramEntityRefs(ws, row.id, entityRefs).catch(() => {});
    await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    const savedRow = await reloadContentNode(db, ws, row.id);

    if (isUpdate) {
      const changes = computeChanges(extractEntityFields(existingFile), extractEntityFields(savedRow));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'content_node',
        entityId: row.id,
        entityName: savedRow.name,
        changes,
        metadata: { entity_id: entityUuid, path: filePath }
      });
    } else {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: savedRow.name,
        changes: {
          new: extractEntityFields(savedRow)
        },
        metadata: { entity_id: entityUuid, path: filePath }
      });
    }

    return toApiProjectFile(savedRow);
  } catch (e) {
    console.error('Error in createEntityFile:', e);
    return handleError(e, 'Failed to create entity diagram');
  }
};

export const renameFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );
    const result = await db.project.renameContentNodeFolder(ws, projectUuid, oldPath, newPath, new Date());
    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${oldPath}'`
    });
    return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to rename folder');
  }
};

export const getFileContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    
    // Try to get as project first
    const project = await db.project.getProject(ws, id);
    
    let file: { id: string; path: string } | null = null;
    let storageId = id;
    
    if (project) {
      // It's a project - use normal project file lookup
      requireProjectAccess(authCtx, project.owner);
      storageId = project.id;
      file = await db.project.getContentNodeByPath(ws, project.id, filePath);
    } else {
      // Not a project - try as entity content (resolve public id → UUID)
      const entity = await db.catalog.getEntity(ws, id);
      if (entity) {
        const entityNodes = await db.project.listEntityContentNodes(ws, entity.id);
        file = entityNodes.find(n => n.path === filePath && n.type === 'diagram') ?? null;
        storageId = entity.id; // entity UUID is used as storage path
      }
    }
    
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    const content = await storage.read(ws, storageId, file.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    if (
      e != null &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'ENOENT'
    ) {
      throw new HTTPError({
        status: 404,
        statusText: 'Not Found',
        message: `File '${filePath}' not found`
      });
    }
    return handleError(e, 'Failed to read file');
  }
};

export const saveFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const content = Buffer.from(JSON.stringify(body), 'utf8');
  const displayName = displayNameFromBody(body, filePath);

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    
    // If not a project, treat as entity diagram
    if (!project) {
      return await createEntityFile(db, storage, workspace, id, filePath, body, event);
    }
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    const isUpdate = !!existingFile;

    const fileLastSlash = filePath.lastIndexOf('/');
    let fileParentId: string | null = null;
    if (fileLastSlash !== -1) {
      const folderPath = filePath.substring(0, fileLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, projectUuid, folderPath);
      fileParentId = parentFolder?.id ?? null;
    }

    // TODO: We should add validation here
    const doc = body as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: projectUuid,
      parent_id: fileParentId,
      path: filePath,
      name: String(displayName),
      size_bytes: content.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile?.created_at ?? timestamp,
      updated_at: timestamp,
      created_byIfNew: existingFile?.created_by ?? authCtx.userId,
      updated_by: authCtx.userId
    });

    await storage.write(ws, projectUuid, row.id, content);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        ws,
        projectUuid,
        row.id,
        content.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );
    } catch {
      await db.project.updateContentNodeDerivedData(
        ws,
        projectUuid,
        row.id,
        content.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        null,
        timestamp
      );
    }

    const entityRefs = getDiagramEntityRefs(doc);
    await db.project.syncDiagramEntityRefs(ws, row.id, entityRefs).catch(() => {});
    await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    const savedRow = await reloadContentNode(db, ws, row.id);

    if (isUpdate) {
      const changes = computeChanges(extractEntityFields(existingFile), extractEntityFields(savedRow));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'content_node',
        entityId: row.id,
        entityName: savedRow.name,
        changes,
        metadata: { project_id: projectUuid, path: filePath }
      });
    } else {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: savedRow.name,
        changes: {
          new: extractEntityFields(savedRow)
        },
        metadata: { project_id: projectUuid, path: filePath }
      });
    }

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to write file');
  }
};

export const deleteFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    const siblingNodes =
      file.type === 'markdown' ? await db.project.listContentNodes(ws, projectUuid) : [];

    await db.project.deleteContentNodeByPath(ws, projectUuid, filePath);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: file.id,
      entityName: file.name,
      changes: {
        old: extractEntityFields(file)
      },
      metadata: { project_id: projectUuid, path: filePath }
    });

    if (file.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(storage, ws, projectUuid, siblingNodes, file.id);
    }
    await storage.delete(ws, projectUuid, file.id).catch(() => {});

    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to delete file');
  }
};

export const cloneFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const sourceFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(sourceFile, { status: 404, message: `File '${filePath}' not found` });

    const baseName = fileNameFromPath(filePath);
    const folder = folderFromPath(filePath);
    const extension = getNodeExtension(sourceFile);
    const baseNameWithoutExt =
      sourceFile.type === 'file'
        ? baseName
        : sourceFile.type === 'markdown' && baseName.endsWith('.md')
          ? baseName.slice(0, -3)
          : stripJsonExtension(baseName);

    let cloneNumber = 1;
    let clonePath: string;
    let cloneName: string;
    do {
      cloneName = `${baseNameWithoutExt} (${cloneNumber})`;
      clonePath = folder ? `${folder}/${cloneName}${extension}` : `${cloneName}${extension}`;
      const existing = await db.project.getContentNodeByPath(ws, projectUuid, clonePath);
      if (!existing) break;
      cloneNumber++;
    } while (cloneNumber < 1000);
    const timestamp = new Date();
    const content = await storage.read(ws, projectUuid, sourceFile.id);
    let clonedContent = content;
    let commentCounts = {
      commentCount: sourceFile.comment_count,
      unresolvedCommentCount: sourceFile.unresolved_comment_count
    };
    let previewSvg = sourceFile.preview_svg;

    if (sourceFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));
      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = cloneName;
      }
      const doc = fileData as unknown as SerializedDiagramDocument;
      clonedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: projectUuid,
      path: clonePath,
      name: cloneName,
      role: sourceFile.role,
      type: sourceFile.type,
      size_bytes: clonedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId,
      mime_type: sourceFile.mime_type,
      original_filename: sourceFile.type === 'file' ? cloneName : sourceFile.original_filename
    });

    await storage.write(ws, projectUuid, row.id, clonedContent);

    if (sourceFile.type === 'diagram') {
      await db.project.updateContentNodeDerivedData(
        ws,
        projectUuid,
        row.id,
        clonedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );

      const fileData = JSON.parse(clonedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      const entityRefs = getDiagramEntityRefs(doc);
      await db.project.syncDiagramEntityRefs(ws, row.id, entityRefs).catch(() => {});
      await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    } else if (sourceFile.type === 'markdown') {
      const siblingNodes = await db.project.listContentNodes(ws, projectUuid);
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        projectUuid,
        sourceFile,
        row,
        siblingNodes,
        authCtx,
        timestamp
      );
    }
    const savedRow = await reloadContentNode(db, ws, row.id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: savedRow.name,
      changes: {
        new: extractEntityFields(savedRow)
      },
      metadata: { project_id: projectUuid, path: clonePath, cloned_from: filePath }
    });

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to clone file');
  }
};

export const relocateFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

    if (filePath === newPath) {
      return toApiProjectFile(existingFile);
    }

    const targetExists = await db.project.getContentNodeByPath(ws, projectUuid, newPath);
    httpAssert.true(!targetExists, {
      status: 409,
      message: `A file already exists at '${newPath}'`
    });
    const attachmentSourceNodes =
      existingFile.type === 'markdown' ? await db.project.listContentNodes(ws, projectUuid) : [];

    const displayName = getDisplayNameForPath(existingFile, newPath);

    const timestamp = new Date();
    const content = await storage.read(ws, projectUuid, existingFile.id);
    let updatedContent = content;
    let commentCounts = {
      commentCount: existingFile.comment_count,
      unresolvedCommentCount: existingFile.unresolved_comment_count
    };
    let previewSvg = existingFile.preview_svg;

    if (existingFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));

      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = displayName;
      }

      const doc = fileData as unknown as SerializedDiagramDocument;
      updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const newLastSlash = newPath.lastIndexOf('/');
    let newParentId: string | null = null;
    if (newLastSlash !== -1) {
      const newFolderPath = newPath.substring(0, newLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, projectUuid, newFolderPath);
      newParentId = parentFolder?.id ?? null;
    }

    const newFile = await db.project.upsertContentNode({
      workspace: ws,
      project_id: projectUuid,
      parent_id: newParentId,
      path: newPath,
      name: displayName,
      role: existingFile.role,
      type: existingFile.type,
      size_bytes: updatedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile.created_at,
      updated_at: timestamp,
      created_byIfNew: existingFile.created_by,
      updated_by: authCtx.userId,
      mime_type: existingFile.mime_type,
      original_filename: existingFile.type === 'file' ? displayName : existingFile.original_filename
    });

    if (existingFile.is_template || existingFile.is_workspace_template) {
      await db.project.updateContentNodeTemplateStatus(
        ws,
        projectUuid,
        newFile.id,
        existingFile.is_template ?? false,
        existingFile.is_workspace_template ?? false,
        timestamp
      );
    }

    await storage.write(ws, projectUuid, newFile.id, updatedContent);

    if (existingFile.type === 'diagram') {
      await db.project.updateContentNodeDerivedData(
        ws,
        projectUuid,
        newFile.id,
        updatedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg,
        timestamp
      );

      const fileData = JSON.parse(updatedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      await syncDiagramContentMetadata(db, ws, newFile.id, doc, timestamp);
    } else if (existingFile.type === 'markdown') {
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        projectUuid,
        existingFile,
        newFile,
        attachmentSourceNodes,
        authCtx,
        timestamp
      );
    }
    const savedFile = await reloadContentNode(db, ws, newFile.id);

    await db.project.deleteContentNodeByPath(ws, projectUuid, filePath);
    if (existingFile.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(
        storage,
        ws,
        projectUuid,
        attachmentSourceNodes,
        existingFile.id
      );
    }
    await storage.delete(ws, projectUuid, existingFile.id).catch(() => {});

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: savedFile.id,
      entityName: displayName,
      changes: {
        old: { path: filePath, name: existingFile.name },
        new: { path: newPath, name: displayName }
      },
      metadata: {
        project_id: projectUuid,
        operation: 'relocate'
      }
    });

    return toApiProjectFile(savedFile);
  } catch (e) {
    return handleError(e, 'Failed to relocate file');
  }
};

export const deleteFolder = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const result = await db.project.deleteContentNodeFolder(ws, projectUuid, folderPath);

    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await Promise.all(result.map(file => storage.delete(ws, projectUuid, file.id).catch(() => {})));

    return { success: true, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to delete folder');
  }
};

export const updateTemplateStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  filePath: string,
  isTemplate: boolean,
  isWorkspaceTemplate: boolean,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    const projectUuid = project.id;

    if (isWorkspaceTemplate) {
      requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
    } else {
      requireProjectAccess(authCtx, project.owner);
    }

    const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.updateContentNodeTemplateStatus(
      ws,
      projectUuid,
      file.id,
      isTemplate,
      isWorkspaceTemplate,
      new Date()
    );

    const updatedFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    return toApiProjectFile(updatedFile!);
  } catch (e) {
    return handleError(e, 'Failed to update template status');
  }
};

export const listProjectEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ProjectEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const rows = await db.project.listProjectEntities(ws, project.id);
    return rows.map(toApiProjectEntity);
  } catch (e) {
    return handleError(e, 'Failed to retrieve project entities');
  }
};

export const addProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  input: { entity_id: string; entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    const row = await db.project.addProjectEntity({
      workspace: ws,
      project_id: project.id,
      entity_id: input.entity_id,
      entity_type_id: input.entity_type ?? null,
      is_done: input.is_done ?? false,
      created_at: new Date()
    });
    return toApiProjectEntity(row);
  } catch (e) {
    return handleError(e, 'Failed to add entity to project');
  }
};

export const updateProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  input: { entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    const existing = (await db.project.listProjectEntities(ws, project.id)).find(
      e => e.entity_id === entityId
    );
    httpAssert.present(existing, {
      status: 404,
      message: `Entity '${entityId}' not found in project`
    });
    const row = await db.project.updateProjectEntity(
      ws,
      project.id,
      entityId,
      input.entity_type !== undefined ? (input.entity_type ?? null) : existing.entity_type_id,
      input.is_done !== undefined ? input.is_done : existing.is_done
    );
    httpAssert.present(row, { status: 404, message: `Entity '${entityId}' not found in project` });
    return toApiProjectEntity(row);
  } catch (e) {
    return handleError(e, 'Failed to update project entity');
  }
};

export const removeProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    await db.project.removeProjectEntity(ws, project.id, entityId);
    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to remove entity from project');
  }
};

export const getEntityProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<ProjectEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const rows = await db.project.getEntityProjects(ws, entityId);
    return rows.map(toApiProjectEntity);
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity projects');
  }
};

export const listEntityContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const files = await db.project.listEntityContentNodes(ws, entity.id);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity content nodes');
  }
};

export const getEntityDiagramFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<DiagramEntityFile[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const rows = await db.project.getEntityDiagramFiles(ws, entity.id);
    return rows.map(row => ({
      file: {
        id: row.file_id,
        project_id: row.project_id,
        path: row.file_path,
        name: row.file_name,
        size_bytes: row.file_size_bytes,
        comment_count: row.file_comment_count,
        unresolved_comment_count: row.file_unresolved_comment_count,
        type: row.file_type,
        preview_svg: row.file_preview_svg,
        created_at: row.file_created_at.toISOString(),
        updated_at: row.file_updated_at.toISOString(),
        content_metadata:
          row.file_metadata_title !== null ||
          row.file_metadata_description !== null ||
          row.file_metadata_company !== null ||
          row.file_metadata_category !== null ||
          row.file_metadata_keywords.length > 0
            ? {
                title: row.file_metadata_title,
                description: row.file_metadata_description,
                company: row.file_metadata_company,
                category: row.file_metadata_category,
                keywords: row.file_metadata_keywords
              }
            : null
      },
      project: {
        id: row.project_id,
        public_id: row.project_public_id,
        name: row.project_name
      }
    }));
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity diagram files');
  }
};

export const listWorkspaceContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const files = await db.project.listWorkspaceContentNodes(ws);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to retrieve workspace content nodes');
  }
};

export const createWorkspaceFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const parentFolder = wsNodes.find(n => n.path === parentPath && n.type === 'folder');
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create workspace folder');
  }
};

export const createWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const content = Buffer.from(JSON.stringify(body), 'utf8');
  const displayName = displayNameFromBody(body, filePath);

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const existingFile = await db.project.listWorkspaceContentNodes(ws).then(nodes =>
      nodes.find(n => n.path === filePath && n.type === 'diagram')
    );
    const isUpdate = !!existingFile;

    let fileParentId: string | null = null;
    const folderPath = folderFromPath(filePath);
    if (folderPath) {
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const parentFolder = wsNodes.find(n => n.path === folderPath && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const doc = body as unknown as SerializedDiagramDocument;
    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: fileParentId,
      path: filePath,
      name: displayName,
      size_bytes: content.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile?.created_at ?? timestamp,
      updated_at: timestamp,
      created_byIfNew: existingFile?.created_by ?? authCtx.userId,
      updated_by: authCtx.userId
    });

    await storage.write(ws, ws, row.id, content);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateWorkspaceContentNodeDerivedData(
        ws, row.id, content.length,
        commentCounts.commentCount, commentCounts.unresolvedCommentCount, previewSvg ?? null, timestamp
      );
    } catch {
      await db.project.updateWorkspaceContentNodeDerivedData(
        ws, row.id, content.length,
        commentCounts.commentCount, commentCounts.unresolvedCommentCount, null, timestamp
      );
    }

    await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    const savedRow = await reloadContentNode(db, ws, row.id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: isUpdate ? 'update' : 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: savedRow.name,
      changes: isUpdate
        ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(savedRow))
        : { new: extractEntityFields(savedRow) },
      metadata: { path: filePath }
    });

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to create workspace diagram');
  }
};

export const getWorkspaceFileContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    await buildApiAuthCtx(db, ws, event);
    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const file = wsNodes.find(n => n.path === filePath && n.type === 'diagram') ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    const content = await storage.read(ws, ws, file.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    return handleError(e, 'Failed to retrieve workspace file content');
  }
};

export const saveWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return createWorkspaceFile(db, storage, workspace, filePath, body, event);
};

// ── Markdown document operations ──────────────────────────────

const EMPTY_MARKDOWN_BODY = JSON.stringify({ body: '' });

export const createProjectMarkdownDoc = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  projectId: string,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const filePath = folder ? `${folder}/${name}.md` : `${name}.md`;
  const content = Buffer.from(EMPTY_MARKDOWN_BODY, 'utf8');
  const timestamp = new Date();

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    const projectUuid = project.id;
    requireProjectAction(authCtx, project.owner, 'edit_project', 'You do not have permission to modify this project');

    let fileParentId: string | null = null;
    if (folder) {
      const parentFolder = await db.project.getContentNodeByPath(ws, projectUuid, folder);
      fileParentId = parentFolder?.id ?? null;
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: projectUuid,
      entity_id: null,
      parent_id: fileParentId,
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
    await storage.write(ws, projectUuid, row.id, content);
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: { new: extractEntityFields(row) },
      metadata: { project_id: projectUuid, path: filePath }
    });
    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to create markdown document');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  const filePath = folder ? `${folder}/${name}.md` : `${name}.md`;
  const content = Buffer.from(EMPTY_MARKDOWN_BODY, 'utf8');
  const timestamp = new Date();

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    let fileParentId: string | null = null;
    if (folder) {
      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const parentFolder = entityNodes.find(n => n.path === folder && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: fileParentId,
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
    await storage.write(ws, entityUuid, row.id, content);
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: { new: extractEntityFields(row) },
      metadata: { entity_id: entityUuid, path: filePath }
    });
    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to create markdown document');
  }
};

export const createWorkspaceMarkdownDoc = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  name: string,
  folder: string | undefined,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const filePath = folder ? `${folder}/${name}.md` : `${name}.md`;
  const content = Buffer.from(EMPTY_MARKDOWN_BODY, 'utf8');
  const timestamp = new Date();

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    let fileParentId: string | null = null;
    if (folder) {
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const parentFolder = wsNodes.find(n => n.path === folder && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: fileParentId,
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
    await storage.write(ws, ws, row.id, content);
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: { new: extractEntityFields(row) },
      metadata: { path: filePath }
    });
    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to create markdown document');
  }
};

const storageScope = (ws: string, node: { project_id: string | null; entity_id: string | null }) =>
  node.project_id ?? node.entity_id ?? ws;

const requireMarkdownNodeAccess = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: Awaited<ReturnType<typeof buildApiAuthCtx>>,
  node: { project_id: string | null },
  action: 'read' | 'edit'
) => {
  if (!node.project_id) return;

  const project = await db.project.getProject(ws, node.project_id);
  httpAssert.present(project, { status: 404, message: `Project '${node.project_id}' not found` });

  if (action === 'read') {
    requireProjectAccess(authCtx, project.owner);
    return;
  }

  requireProjectAction(authCtx, project.owner, 'edit_project', 'You do not have permission to modify this project');
};

export const getProjectFile = async (
  db: DatabaseAdapter,
  workspace: string,
  fileId: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, fileId);
    httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });
    if (node.project_id) {
      const project = await db.project.getProject(ws, node.project_id);
      httpAssert.present(project, { status: 404, message: 'Project not found' });
      requireProjectAccess(authCtx, project.owner);
      node.project_public_id = project.public_id;
    }
    return toApiProjectFile(node);
  } catch (e) {
    return handleError(e, 'Failed to retrieve file');
  }
};

export const getFileContentById = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  fileId: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, fileId);
    httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });

    let storageId: string;
    if (node.project_id) {
      const project = await db.project.getProject(ws, node.project_id);
      httpAssert.present(project, { status: 404, message: 'Project not found' });
      requireProjectAccess(authCtx, project.owner);
      storageId = node.project_id;
    } else if (node.entity_id) {
      storageId = node.entity_id;
    } else {
      storageId = ws;
    }

    const content = await storage.read(ws, storageId, node.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    return handleError(e, 'Failed to retrieve file content');
  }
};

export const getMarkdownContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<MarkdownContent> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, nodeId);
    httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
    httpAssert.true(node.type === 'markdown', { status: 400, message: 'Node is not a markdown document' });
    await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
    const siblingNodes = await listSiblingNodes(db, ws, node);
    const attachments = getMarkdownAttachmentNodes(siblingNodes, node.id).map(toApiProjectFile);
    const content = await storage.read(ws, storageScope(ws, node), node.id);
    const parsed = JSON.parse(content.toString('utf8')) as { body?: string };
    return { body: parsed.body ?? '', attachments };
  } catch (e) {
    return handleError(e, 'Failed to retrieve markdown content');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, nodeId);
    httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
    httpAssert.true(node.type === 'markdown', { status: 400, message: 'Node is not a markdown document' });
    await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
    const content = Buffer.from(JSON.stringify({ body }), 'utf8');
    await storage.write(ws, storageScope(ws, node), node.id, content);
    const timestamp = new Date();
    const nextName = name?.trim() ? name.trim() : node.name;
    const row = await db.project.upsertContentNode({
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
    const revision = await createContentNodeRevision(
      db,
      ws,
      node.id,
      body,
      nextName,
      authCtx.userId,
      timestamp
    );
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: computeChanges(extractEntityFields(node), extractEntityFields(row)),
      metadata: {
        path: row.path,
        revision_id: revision.id,
        revision_number: revision.revision_number
      }
    });
    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to save markdown content');
  }
};

export const listMarkdownRevisions = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<MarkdownRevisionSummary[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, nodeId);
    httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
    httpAssert.true(node.type === 'markdown', { status: 400, message: 'Node is not a markdown document' });
    await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
    const revisions = await db.project.listMarkdownRevisions(ws, node.id);
    return revisions.map(toApiMarkdownRevisionSummary);
  } catch (e) {
    return handleError(e, 'Failed to retrieve markdown revisions');
  }
};

export const getMarkdownRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  revisionId: string,
  event: AuthenticatedEvent
): Promise<MarkdownRevisionDetail> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, nodeId);
    httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
    httpAssert.true(node.type === 'markdown', { status: 400, message: 'Node is not a markdown document' });
    await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
    const revision = await db.project.getMarkdownRevision(ws, node.id, revisionId);
    httpAssert.present(revision, { status: 404, message: `Revision '${revisionId}' not found` });
    return toApiMarkdownRevisionDetail(revision);
  } catch (e) {
    return handleError(e, 'Failed to retrieve markdown revision');
  }
};

export const restoreMarkdownRevision = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  revisionId: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, nodeId);
    httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
    httpAssert.true(node.type === 'markdown', { status: 400, message: 'Node is not a markdown document' });
    await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
    const revision = await db.project.getMarkdownRevision(ws, node.id, revisionId);
    httpAssert.present(revision, { status: 404, message: `Revision '${revisionId}' not found` });

    const content = Buffer.from(JSON.stringify({ body: revision.body }), 'utf8');
    await storage.write(ws, storageScope(ws, node), node.id, content);
    const timestamp = new Date();
    const nextName = revision.title?.trim() ? revision.title.trim() : node.name;
    const row = await db.project.upsertContentNode({
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
    const restoredRevision = await createContentNodeRevision(
      db,
      ws,
      node.id,
      revision.body,
      nextName,
      authCtx.userId,
      timestamp,
      revision.id
    );
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: computeChanges(extractEntityFields(node), extractEntityFields(row)),
      metadata: {
        path: row.path,
        revision_id: restoredRevision.id,
        revision_number: restoredRevision.revision_number,
        restored_from_revision_id: revision.id
      }
    });
    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to restore markdown revision');
  }
};

// ── Binary file upload / download ─────────────────────────────

export const uploadProjectFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    const isUpdate = !!existingFile;

    const fileLastSlash = filePath.lastIndexOf('/');
    let fileParentId: string | null = null;
    if (fileLastSlash !== -1) {
      const folderPath = filePath.substring(0, fileLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, projectUuid, folderPath);
      fileParentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: projectUuid,
      parent_id: fileParentId,
      path: filePath,
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

    await storage.write(ws, projectUuid, row.id, buffer);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: isUpdate ? 'update' : 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: isUpdate
        ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row))
        : { new: extractEntityFields(row) },
      metadata: { project_id: projectUuid, path: filePath }
    });

    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to upload file');
  }
};

export const downloadProjectFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const projectUuid = project.id;

    const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

    const buffer = await storage.read(ws, projectUuid, file.id);
    return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
  } catch (e) {
    return handleError(e, 'Failed to download file');
  }
};

export const uploadEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const existingFile = await db.project.listEntityContentNodes(ws, entityUuid).then(nodes =>
      nodes.find(n => n.path === filePath && n.type === 'file')
    );
    const isUpdate = !!existingFile;

    let fileParentId: string | null = null;
    const folderPath = folderFromPath(filePath);
    if (folderPath) {
      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const parentFolder = entityNodes.find(n => n.path === folderPath && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: fileParentId,
      path: filePath,
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

    await storage.write(ws, entityUuid, row.id, buffer);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: isUpdate ? 'update' : 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: isUpdate
        ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row))
        : { new: extractEntityFields(row) },
      metadata: { entity_id: entityUuid, path: filePath }
    });

    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to upload entity file');
  }
};

export const downloadEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
    const file = entityNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

    const buffer = await storage.read(ws, entityUuid, file.id);
    return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
  } catch (e) {
    return handleError(e, 'Failed to download entity file');
  }
};

export const uploadWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const existingFile = await db.project.listWorkspaceContentNodes(ws).then(nodes =>
      nodes.find(n => n.path === filePath && n.type === 'file')
    );
    const isUpdate = !!existingFile;

    let fileParentId: string | null = null;
    const folderPath = folderFromPath(filePath);
    if (folderPath) {
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const parentFolder = wsNodes.find(n => n.path === folderPath && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: fileParentId,
      path: filePath,
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

    await storage.write(ws, ws, row.id, buffer);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: isUpdate ? 'update' : 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: isUpdate
        ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row))
        : { new: extractEntityFields(row) },
      metadata: { path: filePath }
    });

    return toApiProjectFile(row);
  } catch (e) {
    return handleError(e, 'Failed to upload workspace file');
  }
};

export const downloadWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    await buildApiAuthCtx(db, ws, event);
    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const file = wsNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

    const buffer = await storage.read(ws, ws, file.id);
    return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
  } catch (e) {
    return handleError(e, 'Failed to download workspace file');
  }
};

// ── Entity content operations ──────────────────────────────────

export const deleteEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
    const file = entityNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.deleteEntityContentNodeByPath(ws, entityUuid, filePath);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: file.id,
      entityName: file.name,
      changes: { old: extractEntityFields(file) },
      metadata: { entity_id: entityUuid, path: filePath }
    });

    if (file.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(storage, ws, entityUuid, entityNodes, file.id);
    }
    await storage.delete(ws, entityUuid, file.id).catch(() => {});

    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to delete entity file');
  }
};

export const deleteEntityFolder = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const result = await db.project.deleteEntityContentNodeFolder(ws, entityUuid, folderPath);

    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await Promise.all(result.map(file => storage.delete(ws, entityUuid, file.id).catch(() => {})));

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: entityUuid,
      entityName: folderPath,
      changes: { old: { path: folderPath, type: 'folder' } },
      metadata: { entity_id: entityUuid, path: folderPath, is_folder: true }
    });

    return { success: true, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to delete entity folder');
  }
};

export const renameEntityFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const result = await db.project.renameEntityContentNodeFolder(ws, entityUuid, oldPath, newPath, new Date());
    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${oldPath}'`
    });

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: entityUuid,
      entityName: newPath,
      changes: { old: { path: oldPath }, new: { path: newPath } },
      metadata: { entity_id: entityUuid, operation: 'rename_folder' }
    });

    return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to rename entity folder');
  }
};

export const cloneEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
    const sourceFile = entityNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(sourceFile, { status: 404, message: `File '${filePath}' not found` });

    const baseName = fileNameFromPath(filePath);
    const folder = folderFromPath(filePath);
    const extension = getNodeExtension(sourceFile);
    const isBinary = sourceFile.type === 'file';
    const baseNameWithoutExt =
      sourceFile.type === 'file'
        ? baseName
        : sourceFile.type === 'markdown' && baseName.endsWith('.md')
          ? baseName.slice(0, -3)
          : stripJsonExtension(baseName);

    let cloneNumber = 1;
    let clonePath: string;
    let cloneName: string;
    do {
      cloneName = `${baseNameWithoutExt} (${cloneNumber})`;
      clonePath = folder ? `${folder}/${cloneName}${extension}` : `${cloneName}${extension}`;
      const existing = entityNodes.find(n => n.path === clonePath);
      if (!existing) break;
      cloneNumber++;
    } while (cloneNumber < 1000);

    const timestamp = new Date();
    const content = await storage.read(ws, entityUuid, sourceFile.id);
    let clonedContent = content;
    let commentCounts = {
      commentCount: sourceFile.comment_count,
      unresolvedCommentCount: sourceFile.unresolved_comment_count
    };
    let previewSvg = sourceFile.preview_svg;

    if (sourceFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));
      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = cloneName;
      }
      const doc = fileData as unknown as SerializedDiagramDocument;
      clonedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      path: clonePath,
      name: cloneName,
      role: sourceFile.role,
      type: sourceFile.type,
      size_bytes: clonedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId,
      mime_type: sourceFile.mime_type,
      original_filename: sourceFile.type === 'file' ? cloneName : sourceFile.original_filename
    });

    await storage.write(ws, entityUuid, row.id, clonedContent);

    if (!isBinary && sourceFile.type === 'diagram') {
      await db.project.updateContentNodeDerivedData(
        ws,
        entityUuid,
        row.id,
        clonedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );
      const fileData = JSON.parse(clonedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    } else if (sourceFile.type === 'markdown') {
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        entityUuid,
        sourceFile,
        row,
        entityNodes,
        authCtx,
        timestamp
      );
    }

    const savedRow = await reloadContentNode(db, ws, row.id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: savedRow.name,
      changes: { new: extractEntityFields(savedRow) },
      metadata: { entity_id: entityUuid, path: clonePath, cloned_from: filePath }
    });

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to clone entity file');
  }
};

export const relocateEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
    const existingFile = entityNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

    if (filePath === newPath) {
      return toApiProjectFile(existingFile);
    }

    const targetExists = entityNodes.find(n => n.path === newPath);
    httpAssert.true(!targetExists, { status: 409, message: `A file already exists at '${newPath}'` });

    const isBinary = existingFile.type === 'file';
    const displayName = getDisplayNameForPath(existingFile, newPath);
    const content = await storage.read(ws, entityUuid, existingFile.id);
    let updatedContent = content;
    let commentCounts = {
      commentCount: existingFile.comment_count,
      unresolvedCommentCount: existingFile.unresolved_comment_count
    };
    let previewSvg = existingFile.preview_svg;

    if (existingFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));
      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = displayName;
      }
      const doc = fileData as unknown as SerializedDiagramDocument;
      updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const newLastSlash = newPath.lastIndexOf('/');
    let newParentId: string | null = null;
    if (newLastSlash !== -1) {
      const newFolderPath = newPath.substring(0, newLastSlash);
      const parentFolder = entityNodes.find(n => n.path === newFolderPath && n.type === 'folder');
      newParentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const newFile = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: newParentId,
      path: newPath,
      name: displayName,
      role: existingFile.role,
      type: existingFile.type,
      size_bytes: updatedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile.created_at,
      updated_at: timestamp,
      created_byIfNew: existingFile.created_by,
      updated_by: authCtx.userId,
      mime_type: existingFile.mime_type,
      original_filename: existingFile.type === 'file' ? displayName : existingFile.original_filename
    });

    const attachmentSourceNodes = existingFile.type === 'markdown' ? entityNodes : [];

    if (!isBinary && existingFile.type === 'diagram') {
      await db.project.updateContentNodeDerivedData(
        ws,
        entityUuid,
        newFile.id,
        updatedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg,
        timestamp
      );
      const fileData = JSON.parse(updatedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      await syncDiagramContentMetadata(db, ws, newFile.id, doc, timestamp);
    } else if (existingFile.type === 'markdown') {
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        entityUuid,
        existingFile,
        newFile,
        attachmentSourceNodes,
        authCtx,
        timestamp
      );
    }

    await storage.write(ws, entityUuid, newFile.id, updatedContent);
    const savedFile = await reloadContentNode(db, ws, newFile.id);
    await db.project.deleteEntityContentNodeByPath(ws, entityUuid, filePath);
    if (existingFile.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(
        storage,
        ws,
        entityUuid,
        attachmentSourceNodes,
        existingFile.id
      );
    }
    await storage.delete(ws, entityUuid, existingFile.id).catch(() => {});

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: newFile.id,
      entityName: displayName,
      changes: {
        old: { path: filePath, name: existingFile.name },
        new: { path: newPath, name: displayName }
      },
      metadata: { entity_id: entityUuid, operation: 'relocate' }
    });

    return toApiProjectFile(savedFile);
  } catch (e) {
    return handleError(e, 'Failed to relocate entity file');
  }
};

// ── Workspace content operations ───────────────────────────────

export const deleteWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const file = wsNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.deleteWorkspaceContentNodeByPath(ws, filePath);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: file.id,
      entityName: file.name,
      changes: { old: extractEntityFields(file) },
      metadata: { path: filePath }
    });

    if (file.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(storage, ws, ws, wsNodes, file.id);
    }
    await storage.delete(ws, ws, file.id).catch(() => {});

    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to delete workspace file');
  }
};

export const deleteWorkspaceFolder = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const result = await db.project.deleteWorkspaceContentNodeFolder(ws, folderPath);

    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await Promise.all(result.map(file => storage.delete(ws, ws, file.id).catch(() => {})));

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: ws,
      entityName: folderPath,
      changes: { old: { path: folderPath, type: 'folder' } },
      metadata: { path: folderPath, is_folder: true }
    });

    return { success: true, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to delete workspace folder');
  }
};

export const renameWorkspaceFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const result = await db.project.renameWorkspaceContentNodeFolder(ws, oldPath, newPath, new Date());
    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${oldPath}'`
    });

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: ws,
      entityName: newPath,
      changes: { old: { path: oldPath }, new: { path: newPath } },
      metadata: { operation: 'rename_folder' }
    });

    return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
  } catch (e) {
    return handleError(e, 'Failed to rename workspace folder');
  }
};

export const cloneWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const sourceFile = wsNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(sourceFile, { status: 404, message: `File '${filePath}' not found` });

    const baseName = fileNameFromPath(filePath);
    const folder = folderFromPath(filePath);
    const isBinary = sourceFile.type === 'file';
    const extension = getNodeExtension(sourceFile);
    const baseNameWithoutExt =
      sourceFile.type === 'file'
        ? baseName
        : sourceFile.type === 'markdown' && baseName.endsWith('.md')
          ? baseName.slice(0, -3)
          : stripJsonExtension(baseName);

    let cloneNumber = 1;
    let clonePath: string;
    let cloneName: string;
    do {
      cloneName = `${baseNameWithoutExt} (${cloneNumber})`;
      clonePath = folder ? `${folder}/${cloneName}${extension}` : `${cloneName}${extension}`;
      const existing = wsNodes.find(n => n.path === clonePath);
      if (!existing) break;
      cloneNumber++;
    } while (cloneNumber < 1000);

    const timestamp = new Date();
    const content = await storage.read(ws, ws, sourceFile.id);
    let clonedContent = content;
    let commentCounts = {
      commentCount: sourceFile.comment_count,
      unresolvedCommentCount: sourceFile.unresolved_comment_count
    };
    let previewSvg = sourceFile.preview_svg;

    if (sourceFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));
      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = cloneName;
      }
      const doc = fileData as unknown as SerializedDiagramDocument;
      clonedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: null,
      path: clonePath,
      name: cloneName,
      role: sourceFile.role,
      type: sourceFile.type,
      size_bytes: clonedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId,
      mime_type: sourceFile.mime_type,
      original_filename: sourceFile.type === 'file' ? cloneName : sourceFile.original_filename
    });

    await storage.write(ws, ws, row.id, clonedContent);

    if (!isBinary && sourceFile.type === 'diagram') {
      await db.project.updateWorkspaceContentNodeDerivedData(
        ws,
        row.id,
        clonedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );
      const fileData = JSON.parse(clonedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      await syncDiagramContentMetadata(db, ws, row.id, doc, timestamp);
    } else if (sourceFile.type === 'markdown') {
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        ws,
        sourceFile,
        row,
        wsNodes,
        authCtx,
        timestamp
      );
    }

    const savedRow = await reloadContentNode(db, ws, row.id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: savedRow.name,
      changes: { new: extractEntityFields(savedRow) },
      metadata: { path: clonePath, cloned_from: filePath }
    });

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to clone workspace file');
  }
};

export const relocateWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const existingFile = wsNodes.find(n => n.path === filePath) ?? null;
    httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

    if (filePath === newPath) {
      return toApiProjectFile(existingFile);
    }

    const targetExists = wsNodes.find(n => n.path === newPath);
    httpAssert.true(!targetExists, { status: 409, message: `A file already exists at '${newPath}'` });

    const isBinary = existingFile.type === 'file';
    const displayName = getDisplayNameForPath(existingFile, newPath);
    const content = await storage.read(ws, ws, existingFile.id);
    let updatedContent = content;
    let commentCounts = {
      commentCount: existingFile.comment_count,
      unresolvedCommentCount: existingFile.unresolved_comment_count
    };
    let previewSvg = existingFile.preview_svg;

    if (existingFile.type === 'diagram') {
      const fileData = JSON.parse(content.toString('utf8'));
      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = displayName;
      }
      const doc = fileData as unknown as SerializedDiagramDocument;
      updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      commentCounts = getDiagramCommentCounts(doc);

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
      } catch {
        previewSvg = null;
      }
    }

    const newLastSlash = newPath.lastIndexOf('/');
    let newParentId: string | null = null;
    if (newLastSlash !== -1) {
      const newFolderPath = newPath.substring(0, newLastSlash);
      const parentFolder = wsNodes.find(n => n.path === newFolderPath && n.type === 'folder');
      newParentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const newFile = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: newParentId,
      path: newPath,
      name: displayName,
      role: existingFile.role,
      type: existingFile.type,
      size_bytes: updatedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile.created_at,
      updated_at: timestamp,
      created_byIfNew: existingFile.created_by,
      updated_by: authCtx.userId,
      mime_type: existingFile.mime_type,
      original_filename: existingFile.type === 'file' ? displayName : existingFile.original_filename
    });

    const attachmentSourceNodes = existingFile.type === 'markdown' ? wsNodes : [];

    if (!isBinary && existingFile.type === 'diagram') {
      await db.project.updateWorkspaceContentNodeDerivedData(
        ws,
        newFile.id,
        updatedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg,
        timestamp
      );
      const fileData = JSON.parse(updatedContent.toString('utf8'));
      const doc = fileData as unknown as SerializedDiagramDocument;
      await syncDiagramContentMetadata(db, ws, newFile.id, doc, timestamp);
    } else if (existingFile.type === 'markdown') {
      await cloneMarkdownAttachmentSubtree(
        db,
        storage,
        ws,
        ws,
        existingFile,
        newFile,
        attachmentSourceNodes,
        authCtx,
        timestamp
      );
    }

    await storage.write(ws, ws, newFile.id, updatedContent);
    const savedFile = await reloadContentNode(db, ws, newFile.id);
    await db.project.deleteWorkspaceContentNodeByPath(ws, filePath);
    if (existingFile.type === 'markdown') {
      await deleteMarkdownAttachmentSubtree(storage, ws, ws, attachmentSourceNodes, existingFile.id);
    }
    await storage.delete(ws, ws, existingFile.id).catch(() => {});

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: newFile.id,
      entityName: displayName,
      changes: {
        old: { path: filePath, name: existingFile.name },
        new: { path: newPath, name: displayName }
      },
      metadata: { operation: 'relocate' }
    });

    return toApiProjectFile(savedFile);
  } catch (e) {
    return handleError(e, 'Failed to relocate workspace file');
  }
};
