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
  Project,
  ProjectDetail,
  ProjectEntity,
  ProjectFile
} from '@arch-register/api-types/projectContract';
import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { formatPublicId } from '../../utils/publicIds';

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

export const buildFileTree = (files: ContentNodeDbResult[]): FileTree => {
  const folderNodes = files.filter(f => f.type === 'folder');
  const nonFolderNodes = files.filter(f => f.type !== 'folder');

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

    return { success: true, message: `Project '${id}' deleted` };
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
      updated_at: timestamp
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

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      // For entity content, find parent by querying entity content nodes
      const entityNodes = await db.project.listEntityContentNodes(ws, entityId);
      const parentFolder = entityNodes.find(n => n.path === parentPath && n.type === 'folder');
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: null,
      entity_id: entityId,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp
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
        metadata: { entity_id: entityId, path: folderPath, is_folder: true }
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

    const existingFile = await db.project.listEntityContentNodes(ws, entityId).then(nodes =>
      nodes.find(n => n.path === filePath && n.type === 'diagram')
    );
    const isUpdate = !!existingFile;

    let fileParentId: string | null = null;
    const folderPath = folderFromPath(filePath);
    if (folderPath) {
      const entityNodes = await db.project.listEntityContentNodes(ws, entityId);
      const parentFolder = entityNodes.find(n => n.path === folderPath && n.type === 'folder');
      fileParentId = parentFolder?.id ?? null;
    }

    const doc = body as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: null,
      entity_id: entityId,
      parent_id: fileParentId,
      path: filePath,
      name: String(displayName),
      size_bytes: content.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile?.created_at ?? timestamp,
      updated_at: timestamp
    });

    await storage.write(ws, entityId, row.id, content);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        ws,
        entityId,
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
        entityId,
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

    if (isUpdate) {
      const changes = computeChanges(extractEntityFields(existingFile), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'content_node',
        entityId: row.id,
        entityName: row.name,
        changes,
        metadata: { entity_id: entityId, path: filePath }
      });
    } else {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: row.name,
        changes: {
          new: extractEntityFields(row)
        },
        metadata: { entity_id: entityId, path: filePath }
      });
    }

    return toApiProjectFile(row);
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
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );
    const result = await db.project.renameContentNodeFolder(ws, id, oldPath, newPath, new Date());
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
      file = await db.project.getContentNodeByPath(ws, id, filePath);
    } else {
      // Not a project - try as entity content
      const entityNodes = await db.project.listEntityContentNodes(ws, id);
      file = entityNodes.find(n => n.path === filePath && n.type === 'diagram') ?? null;
      storageId = id; // entityId is used as storage path for entity diagrams
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

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, id, filePath);
    const isUpdate = !!existingFile;

    const fileLastSlash = filePath.lastIndexOf('/');
    let fileParentId: string | null = null;
    if (fileLastSlash !== -1) {
      const folderPath = filePath.substring(0, fileLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, id, folderPath);
      fileParentId = parentFolder?.id ?? null;
    }

    // TODO: We should add validation here
    const doc = body as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: id,
      parent_id: fileParentId,
      path: filePath,
      name: String(displayName),
      size_bytes: content.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile?.created_at ?? timestamp,
      updated_at: timestamp
    });

    await storage.write(ws, id, row.id, content);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        ws,
        id,
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
        id,
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

    if (isUpdate) {
      const changes = computeChanges(extractEntityFields(existingFile), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'content_node',
        entityId: row.id,
        entityName: row.name,
        changes,
        metadata: { project_id: id, path: filePath }
      });
    } else {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: row.name,
        changes: {
          new: extractEntityFields(row)
        },
        metadata: { project_id: id, path: filePath }
      });
    }

    return toApiProjectFile(row);
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

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const file = await db.project.getContentNodeByPath(ws, id, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.deleteContentNodeByPath(ws, id, filePath);

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
      metadata: { project_id: id, path: filePath }
    });

    await storage.delete(ws, id, file.id).catch(() => {});

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

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const sourceFile = await db.project.getContentNodeByPath(ws, id, filePath);
    httpAssert.present(sourceFile, { status: 404, message: `File '${filePath}' not found` });

    const content = await storage.read(ws, id, sourceFile.id);
    const fileData = JSON.parse(content.toString('utf8'));

    const baseName = fileNameFromPath(filePath);
    const baseNameWithoutExt = stripJsonExtension(baseName);
    const folder = folderFromPath(filePath);

    let cloneNumber = 1;
    let clonePath: string;
    let cloneName: string;
    do {
      cloneName = `${baseNameWithoutExt} (${cloneNumber})`;
      clonePath = folder ? `${folder}/${cloneName}.json` : `${cloneName}.json`;
      const existing = await db.project.getContentNodeByPath(ws, id, clonePath);
      if (!existing) break;
      cloneNumber++;
    } while (cloneNumber < 1000);

    if (fileData && typeof fileData === 'object' && 'name' in fileData) {
      fileData.name = cloneName;
    }

    // TODO: We should add validation for this
    const doc = fileData as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const clonedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
    const commentCounts = getDiagramCommentCounts(doc);

    const row = await db.project.upsertContentNode({
      workspace: ws,
      project_id: id,
      path: clonePath,
      name: cloneName,
      size_bytes: clonedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: timestamp,
      updated_at: timestamp
    });

    await storage.write(ws, id, row.id, clonedContent);

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        ws,
        id,
        row.id,
        clonedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        timestamp
      );
    } catch {
      await db.project.updateContentNodeDerivedData(
        ws,
        id,
        row.id,
        clonedContent.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        null,
        timestamp
      );
    }

    const entityRefs = getDiagramEntityRefs(doc);
    await db.project.syncDiagramEntityRefs(ws, row.id, entityRefs).catch(() => {});

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: {
        new: extractEntityFields(row)
      },
      metadata: { project_id: id, path: clonePath, cloned_from: filePath }
    });

    return toApiProjectFile(row);
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

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, id, filePath);
    httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

    if (filePath === newPath) {
      return toApiProjectFile(existingFile);
    }

    const targetExists = await db.project.getContentNodeByPath(ws, id, newPath);
    httpAssert.true(!targetExists, {
      status: 409,
      message: `A file already exists at '${newPath}'`
    });

    const content = await storage.read(ws, id, existingFile.id);
    const fileData = JSON.parse(content.toString('utf8'));

    const newName = newPath.includes('/')
      ? newPath.substring(newPath.lastIndexOf('/') + 1)
      : newPath;
    const displayName = newName.endsWith('.json') ? newName.slice(0, -5) : newName;

    if (fileData && typeof fileData === 'object' && 'name' in fileData) {
      fileData.name = displayName;
    }

    const doc = fileData as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
    const commentCounts = getDiagramCommentCounts(doc);

    const newLastSlash = newPath.lastIndexOf('/');
    let newParentId: string | null = null;
    if (newLastSlash !== -1) {
      const newFolderPath = newPath.substring(0, newLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, id, newFolderPath);
      newParentId = parentFolder?.id ?? null;
    }

    const newFile = await db.project.upsertContentNode({
      workspace: ws,
      project_id: id,
      parent_id: newParentId,
      path: newPath,
      name: displayName,
      size_bytes: updatedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile.created_at,
      updated_at: timestamp
    });

    if (existingFile.is_template || existingFile.is_workspace_template) {
      await db.project.updateContentNodeTemplateStatus(
        ws,
        id,
        newFile.id,
        existingFile.is_template ?? false,
        existingFile.is_workspace_template ?? false,
        timestamp
      );
    }

    let previewSvg: string | null;
    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
    } catch {
      previewSvg = null;
    }
    await db.project.updateContentNodeDerivedData(
      ws,
      id,
      newFile.id,
      updatedContent.length,
      commentCounts.commentCount,
      commentCounts.unresolvedCommentCount,
      previewSvg,
      timestamp
    );

    await storage.write(ws, id, newFile.id, updatedContent);

    await db.project.deleteContentNodeByPath(ws, id, filePath);
    await storage.delete(ws, id, existingFile.id).catch(() => {});

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
      metadata: {
        project_id: id,
        operation: 'relocate'
      }
    });

    return toApiProjectFile(newFile);
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

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const result = await db.project.deleteContentNodeFolder(ws, id, folderPath);

    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await Promise.all(result.map(file => storage.delete(ws, id, file.id).catch(() => {})));

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

    if (isWorkspaceTemplate) {
      requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
    } else {
      requireProjectAccess(authCtx, project.owner);
    }

    const file = await db.project.getContentNodeByPath(ws, projectId, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.updateContentNodeTemplateStatus(
      ws,
      projectId,
      file.id,
      isTemplate,
      isWorkspaceTemplate,
      new Date()
    );

    const updatedFile = await db.project.getContentNodeByPath(ws, projectId, filePath);
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
        type: row.file_type,
        preview_svg: row.file_preview_svg,
        created_at: row.file_created_at.toISOString(),
        updated_at: row.file_updated_at.toISOString()
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
      updated_at: timestamp
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
      updated_at: timestamp
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

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: isUpdate ? 'update' : 'create',
      entityType: 'content_node',
      entityId: row.id,
      entityName: row.name,
      changes: isUpdate ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row)) : { new: extractEntityFields(row) },
      metadata: { path: filePath }
    });

    return toApiProjectFile(row);
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
