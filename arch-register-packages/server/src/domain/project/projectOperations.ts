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
  requireWorkspaceAdmin,
  requireWorkspaceCapability
} from '../auth/authorization';
import {
  logAudit,
  writeAudit,
  extractEntityFields,
  computeChanges
} from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import {
  fileNameFromPath,
  displayNameFromBody,
  folderFromPath,
  stripJsonExtension
} from './contentFileHelpers';
import {
  ATTACHMENT_CONTAINER_NAME,
  collectDescendantNodes,
  CONTENT_NODE_ROLE_ATTACHMENT_CONTAINER,
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
  buildFileTree,
  deleteContentFile,
  deleteContentFolder,
  renameContentFolder
} from './contentTreeOperations';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import type { ContentScopeResolver } from './contentScope';
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
import { coordinateContentWrite } from './contentWriteCoordinator';

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

export { buildFileTree };

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

const getDisplayNameForPath = (node: Pick<ContentNodeDbResult, 'type'>, path: string) => {
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
    requireNonProjectContentAccess(authCtx, 'edit');
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

const writeScopedDiagram = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const existing = nodes.find(node => node.path === filePath && node.type === 'diagram');
  const folderPath = folderFromPath(filePath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
  const content = Buffer.from(JSON.stringify(body));
  const doc = body as unknown as SerializedDiagramDocument;
  const timestamp = new Date();
  const counts = getDiagramCommentCounts(doc);
  const nodeId = existing?.id ?? randomUUID();
  let saved!: ContentNodeDbResult;

  await coordinateContentWrite({
    db,
    storage,
    operation: existing ? 'update' : 'create',
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
      await tx.project.upsertContentNode({
        id: nodeId,
        workspace: ws,
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: parentId,
        path: filePath,
        name: displayNameFromBody(body, filePath),
        size_bytes: content.length,
        comment_count: counts.commentCount,
        unresolved_comment_count: counts.unresolvedCommentCount,
        created_atIfNew: existing?.created_at ?? timestamp,
        updated_at: timestamp,
        created_byIfNew: existing?.created_by ?? authCtx.userId,
        updated_by: authCtx.userId
      });
      await syncDiagramContentMetadata(tx, ws, nodeId, doc, timestamp);
      saved = await reloadContentNode(tx, ws, nodeId);
    },
    afterCommit: [
      {
        name: 'preview',
        run: async () => {
          const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
          const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
          const preview =
            (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
          if (resolved.kind === 'workspace') {
            await db.project.updateWorkspaceContentNodeDerivedData(
              ws,
              nodeId,
              content.length,
              counts.commentCount,
              counts.unresolvedCommentCount,
              preview,
              timestamp
            );
          } else {
            await db.project.updateContentNodePreview(ws, resolved.storageId, nodeId, preview);
          }
        }
      },
      {
        name: 'references',
        run: () => db.project.syncDiagramEntityRefs(ws, nodeId, getDiagramEntityRefs(doc))
      },
      {
        name: 'audit',
        run: () =>
          writeAudit(db, {
            userId: authCtx.userId,
            workspace: ws,
            operation: existing ? 'update' : 'create',
            entityType: 'content_node',
            entityId: nodeId,
            entityName: saved.name,
            changes: existing
              ? computeChanges(extractEntityFields(existing), extractEntityFields(saved))
              : { new: extractEntityFields(saved) },
            metadata: { ...resolved.auditMetadata, path: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
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
  return writeScopedDiagram(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, body, event);
};

export const renameFolder = (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(PROJECT_SCOPE, db, workspace, id, oldPath, newPath, event);

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
    const nodeId = existingFile?.id ?? randomUUID();
    const entityRefs = getDiagramEntityRefs(doc);
    let savedRow!: ContentNodeDbResult;
    await coordinateContentWrite({
      db,
      storage,
      operation: isUpdate ? 'update' : 'create',
      scope: 'project',
      nodeIds: [nodeId],
      storageChanges: [{ type: 'write', workspace: ws, storageId: projectUuid, nodeId, content }],
      writeDatabase: async tx => {
        const row = await tx.project.upsertContentNode({
          id: nodeId,
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
        await syncDiagramContentMetadata(tx, ws, row.id, doc, timestamp);
        savedRow = await reloadContentNode(tx, ws, row.id);
      },
      afterCommit: [
        {
          name: 'preview',
          run: async () => {
            const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
            const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
            const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
            await db.project.updateContentNodePreview(ws, projectUuid, nodeId, previewSvg ?? null);
          }
        },
        { name: 'references', run: () => db.project.syncDiagramEntityRefs(ws, nodeId, entityRefs) },
        {
          name: 'audit',
          run: () =>
            writeAudit(db, {
              userId: authCtx.userId,
              workspace: ws,
              operation: isUpdate ? 'update' : 'create',
              entityType: 'content_node',
              entityId: nodeId,
              entityName: savedRow.name,
              changes: isUpdate
                ? computeChanges(extractEntityFields(existingFile), extractEntityFields(savedRow))
                : { new: extractEntityFields(savedRow) },
              metadata: { project_id: projectUuid, path: filePath }
            })
        }
      ]
    });

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

    const attachmentNodes =
      file.type === 'markdown'
        ? (() => {
            const container = getAttachmentContainerForMarkdownNode(siblingNodes, file.id);
            return container
              ? [container, ...collectDescendantNodes(siblingNodes, container.id)]
              : [];
          })()
        : [];
    const blobNodes = [file, ...attachmentNodes].filter(node => node.type !== 'folder');
    await coordinateContentWrite({
      db,
      storage,
      operation: 'delete',
      scope: 'project',
      nodeIds: [file.id, ...attachmentNodes.map(node => node.id)],
      storageChanges: blobNodes.map(node => ({
        type: 'delete' as const,
        workspace: ws,
        storageId: projectUuid,
        nodeId: node.id
      })),
      writeDatabase: async tx => {
        await tx.project.deleteContentNodeByPath(ws, projectUuid, filePath);
      },
      afterCommit: [
        {
          name: 'audit',
          run: () =>
            writeAudit(db, {
              userId: authCtx.userId,
              workspace: ws,
              operation: 'delete',
              entityType: 'content_node',
              entityId: file.id,
              entityName: file.name,
              changes: { old: extractEntityFields(file) },
              metadata: { project_id: projectUuid, path: filePath }
            })
        }
      ]
    });

    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to delete file');
  }
};

const cloneScopedContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const source = nodes.find(node => node.path === filePath);
  httpAssert.present(source, { status: 404, message: `File '${filePath}' not found` });
  const baseName = fileNameFromPath(filePath);
  const folder = folderFromPath(filePath);
  const extension = getNodeExtension(source);
  const stem =
    source.type === 'file'
      ? baseName
      : source.type === 'markdown' && baseName.endsWith('.md')
        ? baseName.slice(0, -3)
        : stripJsonExtension(baseName);
  let cloneName = '';
  let clonePath = '';
  for (let number = 1; number < 1000; number++) {
    cloneName = `${stem} (${number})`;
    clonePath = folder ? `${folder}/${cloneName}${extension}` : `${cloneName}${extension}`;
    if (!nodes.some(node => node.path === clonePath)) break;
  }

  const timestamp = new Date();
  const rootId = randomUUID();
  const sourceContent = await storage.read(ws, resolved.storageId, source.id);
  let rootContent = sourceContent;
  let doc: SerializedDiagramDocument | undefined;
  let commentCounts = {
    commentCount: source.comment_count,
    unresolvedCommentCount: source.unresolved_comment_count
  };
  if (source.type === 'diagram') {
    const parsed = JSON.parse(sourceContent.toString('utf8'));
    if (parsed && typeof parsed === 'object' && 'name' in parsed) parsed.name = cloneName;
    doc = parsed as SerializedDiagramDocument;
    rootContent = Buffer.from(JSON.stringify(parsed));
    commentCounts = getDiagramCommentCounts(doc);
  }

  const container =
    source.type === 'markdown'
      ? getAttachmentContainerForMarkdownNode(nodes, source.id)
      : undefined;
  const attachmentSources = container
    ? [container, ...collectDescendantNodes(nodes, container.id)]
    : [];
  const idMap = new Map<string, string>([[source.id, rootId]]);
  for (const node of attachmentSources) idMap.set(node.id, randomUUID());
  const attachmentContents = new Map<string, Buffer>();
  for (const node of attachmentSources) {
    if (node.type !== 'folder') {
      attachmentContents.set(node.id, await storage.read(ws, resolved.storageId, node.id));
    }
  }

  let saved!: ContentNodeDbResult;
  const storageChanges = [
    {
      type: 'write' as const,
      workspace: ws,
      storageId: resolved.storageId,
      nodeId: rootId,
      content: rootContent
    },
    ...attachmentSources
      .filter(node => node.type !== 'folder')
      .map(node => ({
        type: 'write' as const,
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: idMap.get(node.id)!,
        content: attachmentContents.get(node.id)!
      }))
  ];
  await coordinateContentWrite({
    db,
    storage,
    operation: 'clone',
    scope: resolved.kind,
    nodeIds: [rootId, ...attachmentSources.map(node => idMap.get(node.id)!)],
    storageChanges,
    writeDatabase: async tx => {
      saved = await tx.project.upsertContentNode({
        id: rootId,
        workspace: ws,
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: source.parent_id,
        path: clonePath,
        name: cloneName,
        role: source.role,
        type: source.type,
        size_bytes: rootContent.length,
        comment_count: commentCounts.commentCount,
        unresolved_comment_count: commentCounts.unresolvedCommentCount,
        created_atIfNew: timestamp,
        updated_at: timestamp,
        created_byIfNew: authCtx.userId,
        updated_by: authCtx.userId,
        mime_type: source.mime_type,
        original_filename: source.type === 'file' ? cloneName : source.original_filename
      });
      const oldRoot = source.path.endsWith('.md') ? source.path.slice(0, -3) : source.path;
      const newRoot = clonePath.endsWith('.md') ? clonePath.slice(0, -3) : clonePath;
      for (const node of attachmentSources) {
        await tx.project.upsertContentNode({
          id: idMap.get(node.id)!,
          workspace: ws,
          project_id: resolved.projectId,
          entity_id: resolved.entityId,
          parent_id:
            node.parent_id === source.id ? rootId : (idMap.get(node.parent_id ?? '') ?? null),
          path: buildRelocatedAttachmentPath(oldRoot, newRoot, node.path),
          name: node.name,
          role: node.role,
          type: node.type,
          size_bytes: node.size_bytes,
          comment_count: node.comment_count,
          unresolved_comment_count: node.unresolved_comment_count,
          created_atIfNew: timestamp,
          updated_at: timestamp,
          created_byIfNew: authCtx.userId,
          updated_by: authCtx.userId,
          mime_type: node.mime_type,
          original_filename: node.original_filename
        });
      }
      if (doc) await syncDiagramContentMetadata(tx, ws, rootId, doc, timestamp);
      saved = await reloadContentNode(tx, ws, rootId);
    },
    afterCommit: [
      ...(doc
        ? [
            {
              name: 'preview' as const,
              run: async () => {
                const { generateAccurateSvgPreview } = await import(
                  '../diagram/serverDiagramRenderer'
                );
                const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
                const preview =
                  (await generateAccurateSvgPreview(doc!)) ?? generateSvgPreview(doc!) ?? null;
                if (resolved.kind === 'workspace') {
                  await db.project.updateWorkspaceContentNodeDerivedData(
                    ws,
                    rootId,
                    rootContent.length,
                    commentCounts.commentCount,
                    commentCounts.unresolvedCommentCount,
                    preview,
                    timestamp
                  );
                } else {
                  await db.project.updateContentNodePreview(
                    ws,
                    resolved.storageId,
                    rootId,
                    preview
                  );
                }
              }
            }
          ]
        : []),
      ...(doc
        ? [
            {
              name: 'references' as const,
              run: () => db.project.syncDiagramEntityRefs(ws, rootId, getDiagramEntityRefs(doc!))
            }
          ]
        : []),
      {
        name: 'audit',
        run: () =>
          writeAudit(db, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'content_node',
            entityId: rootId,
            entityName: saved.name,
            changes: { new: extractEntityFields(saved) },
            metadata: { ...resolved.auditMetadata, path: clonePath, cloned_from: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
};

export const cloneFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(PROJECT_SCOPE, db, storage, workspace, id, filePath, event);
};

const relocateScopedContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const source = nodes.find(node => node.path === filePath);
  httpAssert.present(source, { status: 404, message: `File '${filePath}' not found` });
  if (filePath === newPath) return toApiProjectFile(source);
  httpAssert.true(!nodes.some(node => node.path === newPath), {
    status: 409,
    message: `A file already exists at '${newPath}'`
  });
  const displayName = getDisplayNameForPath(source, newPath);
  const folderPath = folderFromPath(newPath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
  const timestamp = new Date();
  const rootId = randomUUID();
  const sourceContent = await storage.read(ws, resolved.storageId, source.id);
  let rootContent = sourceContent;
  let doc: SerializedDiagramDocument | undefined;
  let counts = {
    commentCount: source.comment_count,
    unresolvedCommentCount: source.unresolved_comment_count
  };
  if (source.type === 'diagram') {
    const parsed = JSON.parse(sourceContent.toString('utf8'));
    if (parsed && typeof parsed === 'object' && 'name' in parsed) parsed.name = displayName;
    doc = parsed as SerializedDiagramDocument;
    rootContent = Buffer.from(JSON.stringify(parsed));
    counts = getDiagramCommentCounts(doc);
  }
  const container =
    source.type === 'markdown'
      ? getAttachmentContainerForMarkdownNode(nodes, source.id)
      : undefined;
  const attachmentSources = container
    ? [container, ...collectDescendantNodes(nodes, container.id)]
    : [];
  const idMap = new Map<string, string>([[source.id, rootId]]);
  for (const node of attachmentSources) idMap.set(node.id, randomUUID());
  const attachmentContents = new Map<string, Buffer>();
  for (const node of attachmentSources) {
    if (node.type !== 'folder') {
      attachmentContents.set(node.id, await storage.read(ws, resolved.storageId, node.id));
    }
  }
  const oldBlobs = [source, ...attachmentSources].filter(node => node.type !== 'folder');
  let saved!: ContentNodeDbResult;
  await coordinateContentWrite({
    db,
    storage,
    operation: 'move',
    scope: resolved.kind,
    nodeIds: [
      source.id,
      rootId,
      ...attachmentSources.flatMap(node => [node.id, idMap.get(node.id)!])
    ],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: rootId,
        content: rootContent
      },
      ...attachmentSources
        .filter(node => node.type !== 'folder')
        .map(node => ({
          type: 'write' as const,
          workspace: ws,
          storageId: resolved.storageId,
          nodeId: idMap.get(node.id)!,
          content: attachmentContents.get(node.id)!
        })),
      ...oldBlobs.map(node => ({
        type: 'delete' as const,
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: node.id
      }))
    ],
    writeDatabase: async tx => {
      saved = await tx.project.upsertContentNode({
        id: rootId,
        workspace: ws,
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: parentId,
        path: newPath,
        name: displayName,
        role: source.role,
        type: source.type,
        size_bytes: rootContent.length,
        comment_count: counts.commentCount,
        unresolved_comment_count: counts.unresolvedCommentCount,
        created_atIfNew: source.created_at,
        updated_at: timestamp,
        created_byIfNew: source.created_by,
        updated_by: authCtx.userId,
        mime_type: source.mime_type,
        original_filename: source.type === 'file' ? displayName : source.original_filename
      });
      const oldRoot = source.path.endsWith('.md') ? source.path.slice(0, -3) : source.path;
      const newRoot = newPath.endsWith('.md') ? newPath.slice(0, -3) : newPath;
      for (const node of attachmentSources) {
        await tx.project.upsertContentNode({
          id: idMap.get(node.id)!,
          workspace: ws,
          project_id: resolved.projectId,
          entity_id: resolved.entityId,
          parent_id:
            node.parent_id === source.id ? rootId : (idMap.get(node.parent_id ?? '') ?? null),
          path: buildRelocatedAttachmentPath(oldRoot, newRoot, node.path),
          name: node.name,
          role: node.role,
          type: node.type,
          size_bytes: node.size_bytes,
          comment_count: node.comment_count,
          unresolved_comment_count: node.unresolved_comment_count,
          created_atIfNew: node.created_at,
          updated_at: timestamp,
          created_byIfNew: node.created_by,
          updated_by: authCtx.userId,
          mime_type: node.mime_type,
          original_filename: node.original_filename
        });
      }
      if (doc) await syncDiagramContentMetadata(tx, ws, rootId, doc, timestamp);
      await resolved.deleteNodeByPath(tx, ws, filePath);
      saved = await reloadContentNode(tx, ws, rootId);
    },
    afterCommit: [
      ...(doc
        ? [
            {
              name: 'preview' as const,
              run: async () => {
                const { generateAccurateSvgPreview } = await import(
                  '../diagram/serverDiagramRenderer'
                );
                const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
                const preview =
                  (await generateAccurateSvgPreview(doc!)) ?? generateSvgPreview(doc!) ?? null;
                if (resolved.kind === 'workspace') {
                  await db.project.updateWorkspaceContentNodeDerivedData(
                    ws,
                    rootId,
                    rootContent.length,
                    counts.commentCount,
                    counts.unresolvedCommentCount,
                    preview,
                    timestamp
                  );
                } else {
                  await db.project.updateContentNodePreview(
                    ws,
                    resolved.storageId,
                    rootId,
                    preview
                  );
                }
              }
            }
          ]
        : []),
      ...(doc
        ? [
            {
              name: 'references' as const,
              run: () => db.project.syncDiagramEntityRefs(ws, rootId, getDiagramEntityRefs(doc!))
            }
          ]
        : []),
      {
        name: 'audit',
        run: () =>
          writeAudit(db, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'update',
            entityType: 'content_node',
            entityId: rootId,
            entityName: displayName,
            changes: {
              old: { path: filePath, name: source.name },
              new: { path: newPath, name: displayName }
            },
            metadata: { ...resolved.auditMetadata, operation: 'relocate' }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
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
  return relocateScopedContentFile(PROJECT_SCOPE, db, storage, workspace, id, filePath, newPath, event);
};

export const deleteFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(PROJECT_SCOPE, db, storage, workspace, id, folderPath, event);

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
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireNonProjectContentAccess(authCtx, 'read');
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
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireNonProjectContentAccess(authCtx, 'read');
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
    requireNonProjectContentAccess(authCtx, 'edit');

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
  return writeScopedDiagram(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    body,
    event
  );
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
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'read');
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
  return createScopedMarkdownDoc(PROJECT_SCOPE, db, storage, workspace, projectId, name, folder, event);
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
  return createScopedMarkdownDoc(ENTITY_SCOPE, db, storage, workspace, entityId, name, folder, event);
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

export const storageScope = (
  ws: string,
  node: { project_id: string | null; entity_id: string | null }
) => node.project_id ?? node.entity_id ?? ws;

const requireNonProjectContentAccess = (
  authCtx: Awaited<ReturnType<typeof buildApiAuthCtx>>,
  action: 'read' | 'edit'
) =>
  requireWorkspaceCapability(
    authCtx,
    action === 'read' ? 'content.view' : 'content.edit',
    `You do not have permission to ${action === 'read' ? 'view' : 'modify'} workspace content`
  );

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
  node: { project_id: string | null },
  action: 'read' | 'edit'
) => {
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
    } else {
      requireNonProjectContentAccess(authCtx, 'read');
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
      requireNonProjectContentAccess(authCtx, 'read');
      storageId = node.entity_id;
    } else {
      requireNonProjectContentAccess(authCtx, 'read');
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
    httpAssert.true(node.type === 'markdown', {
      status: 400,
      message: 'Node is not a markdown document'
    });
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const fileName = fileNameFromPath(filePath) || originalFilename;
    const authCtx = await buildApiAuthCtx(db, ws, event);
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
      scope: markdownNode.project_id ? 'project' : markdownNode.entity_id ? 'entity' : 'workspace',
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
  } catch (e) {
    return handleError(e, 'Failed to upload markdown attachment');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
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
      scope: markdownNode.project_id ? 'project' : markdownNode.entity_id ? 'entity' : 'workspace',
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
  } catch (e) {
    return handleError(e, 'Failed to create diagram attachment');
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
    httpAssert.true(node.type === 'markdown', {
      status: 400,
      message: 'Node is not a markdown document'
    });
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
    httpAssert.true(node.type === 'markdown', {
      status: 400,
      message: 'Node is not a markdown document'
    });
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
  } catch (e) {
    return handleError(e, 'Failed to restore markdown revision');
  }
};

// ── Binary file upload / download ─────────────────────────────

const uploadScopedFile = async (
  scope: typeof PROJECT_SCOPE,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const existingFile = nodes.find(node => node.path === filePath && node.type === 'file');
  const folderPath = folderFromPath(filePath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
  const timestamp = new Date();
  const nodeId = existingFile?.id ?? randomUUID();
  let row!: ContentNodeDbResult;

  await coordinateContentWrite({
    db,
    storage,
    operation: existingFile ? 'update-upload' : 'create-upload',
    scope: resolved.kind,
    nodeIds: [nodeId],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId,
        content: buffer
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
            operation: existingFile ? 'update' : 'create',
            entityType: 'content_node',
            entityId: row.id,
            entityName: row.name,
            changes: existingFile
              ? computeChanges(extractEntityFields(existingFile), extractEntityFields(row))
              : { new: extractEntityFields(row) },
            metadata: { ...resolved.auditMetadata, path: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(row);
};

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
  return uploadScopedFile(
    PROJECT_SCOPE,
    db,
    storage,
    workspace,
    id,
    filePath,
    buffer,
    mimeType,
    originalFilename,
    event
  );
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
  return uploadScopedFile(
    ENTITY_SCOPE,
    db,
    storage,
    workspace,
    entityId,
    filePath,
    buffer,
    mimeType,
    originalFilename,
    event
  );
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
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'read');
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
  return uploadScopedFile(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    buffer,
    mimeType,
    originalFilename,
    event
  );
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
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'read');
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
  return deleteContentFile(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, event);
};

export const deleteEntityFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(ENTITY_SCOPE, db, storage, workspace, entityId, folderPath, event);

export const renameEntityFolder = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(ENTITY_SCOPE, db, workspace, entityId, oldPath, newPath, event);

export const cloneEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, event);
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
  return relocateScopedContentFile(
    ENTITY_SCOPE,
    db,
    storage,
    workspace,
    entityId,
    filePath,
    newPath,
    event
  );
};

// ── Workspace content operations ───────────────────────────────

export const deleteWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  return deleteContentFile(WORKSPACE_SCOPE, db, storage, workspace, undefined, filePath, event);
};

export const deleteWorkspaceFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(WORKSPACE_SCOPE, db, storage, workspace, undefined, folderPath, event);

export const renameWorkspaceFolder = (
  db: DatabaseAdapter,
  workspace: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(WORKSPACE_SCOPE, db, workspace, undefined, oldPath, newPath, event);

export const cloneWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(WORKSPACE_SCOPE, db, storage, workspace, undefined, filePath, event);
};

export const relocateWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return relocateScopedContentFile(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    newPath,
    event
  );
};
