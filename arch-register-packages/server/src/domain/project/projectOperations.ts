import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { getDiagramCommentCounts } from '../diagram/commentCounts';
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
import { toApiProject, toApiProjectFile, toApiProjectDetail } from './projectHelpers';
import type { ProjectFileDbResult } from './db/projectDatabase';
import { HTTPError } from 'h3';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import {
  FileTree,
  Project,
  ProjectDetail,
  ProjectFile
} from '@arch-register/api-types/projectContract';

const PROJECT_STATUSES = ['pinned', 'active', 'archived'] as const;
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

export const buildFileTree = (files: ProjectFileDbResult[]): FileTree => {
  const rootFiles = files.filter(f => f.path.indexOf('/') === -1).map(toApiProjectFile);

  const folderMap = new Map<string, ProjectFileDbResult[]>();

  for (const f of files) {
    const lastSlash = f.path.lastIndexOf('/');
    if (lastSlash !== -1) {
      const folder = f.path.substring(0, lastSlash);
      const existing = folderMap.get(folder);
      if (existing) {
        existing.push(f);
      } else {
        folderMap.set(folder, [f]);
      }
    }
  }

  const folders = Array.from(folderMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, files]) => ({
      path,
      files: files.map(toApiProjectFile)
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
      visibleProjects.map(project => db.project.listProjectFiles(ws, project.id))
    );
    for (const files of projectFiles) {
      for (const file of files) {
        fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
      }
    }
    return visibleProjects
      .map(project => toApiProject(project, fileCounts.get(project.id) ?? 0, authCtx))
      .sort((a, b) => {
        const rank = { pinned: 0, active: 1, archived: 2 } as const;
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
    const files = await db.project.listProjectFiles(ws, id);
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
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
  },
  event: AuthenticatedEvent
): Promise<Project> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const teamIds = new Set((await db.workspace.listTeams(ws)).map(row => row.id));
    const timestamp = new Date();

    httpAssert.present(input.name, { message: 'name is required' });

    const createInput = {
      id: randomUUID(),
      workspace: ws,
      name: input.name,
      description: input.description ?? '',
      owner: resolveProjectOwner(input.owner, teamIds),
      status: parseProjectStatus(input.status),
      color: typeof input.color === 'string' ? input.color : null,
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
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
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

    const row = await db.project.updateProject(ws, id, updateInput);
    httpAssert.present(row, { status: 404, message: `Project '${id}' not found` });

    const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'project',
      entityId: id,
      entityName: row.name,
      changes
    });

    const fileCount = (await db.project.listProjectFiles(ws, id)).length;
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

    await db.project.deleteProject(ws, id);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'project',
      entityId: id,
      entityName: project.name,
      changes: { old: extractEntityFields(project) }
    });

    if (storage) {
      await storage.deleteAll(ws, id).catch(() => {});
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
    const files = await db.project.listProjectFiles(ws, id);
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
  const markerPath = `${folderPath}/.keep`;
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
    const timestamp = new Date();
    const row = await db.project.createProjectFileIfAbsent({
      workspace: ws,
      project_id: id,
      path: markerPath,
      name: '.keep',
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
        entityType: 'project_file',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { project_id: id, path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create folder');
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
    const result = await db.project.renameProjectFileFolder(ws, id, oldPath, newPath, new Date());
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
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAccess(authCtx, project.owner);

    const file = await db.project.getProjectFileByPath(ws, id, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    const content = await storage.read(ws, id, file.id);
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
  const fileName = filePath.includes('/')
    ? filePath.substring(filePath.lastIndexOf('/') + 1)
    : filePath;

  const displayName =
    body['name'] ?? (fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName);

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

    const existingFile = await db.project.getProjectFileByPath(ws, id, filePath);
    const isUpdate = !!existingFile;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(body as any);
    const row = await db.project.upsertProjectFile({
      workspace: ws,
      project_id: id,
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
      const previewSvg =
        (await generateAccurateSvgPreview(body as any)) ?? generateSvgPreview(body as any);
      await db.project.updateProjectFileDerivedData(
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
      await db.project.updateProjectFileDerivedData(
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

    if (isUpdate) {
      const changes = computeChanges(extractEntityFields(existingFile), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'project_file',
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
        entityType: 'project_file',
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

    const file = await db.project.getProjectFileByPath(ws, id, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.deleteProjectFileByPath(ws, id, filePath);

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'project_file',
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

    const sourceFile = await db.project.getProjectFileByPath(ws, id, filePath);
    httpAssert.present(sourceFile, { status: 404, message: `File '${filePath}' not found` });

    const content = await storage.read(ws, id, sourceFile.id);
    const fileData = JSON.parse(content.toString('utf8'));

    const baseName = filePath.includes('/')
      ? filePath.substring(filePath.lastIndexOf('/') + 1)
      : filePath;
    const baseNameWithoutExt = baseName.endsWith('.json') ? baseName.slice(0, -5) : baseName;
    const folder = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

    let cloneNumber = 1;
    let clonePath: string;
    let cloneName: string;
    do {
      cloneName = `${baseNameWithoutExt} (${cloneNumber})`;
      clonePath = folder ? `${folder}/${cloneName}.json` : `${cloneName}.json`;
      const existing = await db.project.getProjectFileByPath(ws, id, clonePath);
      if (!existing) break;
      cloneNumber++;
    } while (cloneNumber < 1000);

    if (fileData && typeof fileData === 'object' && 'name' in fileData) {
      fileData.name = cloneName;
    }

    const timestamp = new Date();
    const clonedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
    const commentCounts = getDiagramCommentCounts(fileData as any);

    const row = await db.project.upsertProjectFile({
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
      const previewSvg =
        (await generateAccurateSvgPreview(fileData as any)) ?? generateSvgPreview(fileData as any);
      await db.project.updateProjectFileDerivedData(
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
      await db.project.updateProjectFileDerivedData(
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

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'create',
      entityType: 'project_file',
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

    const existingFile = await db.project.getProjectFileByPath(ws, id, filePath);
    httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

    if (filePath === newPath) {
      return toApiProjectFile(existingFile);
    }

    const targetExists = await db.project.getProjectFileByPath(ws, id, newPath);
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

    const timestamp = new Date();
    const updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
    const commentCounts = getDiagramCommentCounts(fileData as any);

    const newFile = await db.project.upsertProjectFile({
      workspace: ws,
      project_id: id,
      path: newPath,
      name: displayName,
      size_bytes: updatedContent.length,
      comment_count: commentCounts.commentCount,
      unresolved_comment_count: commentCounts.unresolvedCommentCount,
      created_atIfNew: existingFile.created_at,
      updated_at: timestamp
    });

    if (existingFile.is_template || existingFile.is_workspace_template) {
      await db.project.updateProjectFileTemplateStatus(
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
      previewSvg =
        (await generateAccurateSvgPreview(fileData as any)) ??
        generateSvgPreview(fileData as any) ??
        null;
    } catch {
      previewSvg = null;
    }
    await db.project.updateProjectFileDerivedData(
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

    await db.project.deleteProjectFileByPath(ws, id, filePath);
    await storage.delete(ws, id, existingFile.id).catch(() => {});

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'project_file',
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

    const result = await db.project.deleteProjectFileFolder(ws, id, folderPath);

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

    const file = await db.project.getProjectFileByPath(ws, projectId, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.updateProjectFileTemplateStatus(
      ws,
      projectId,
      file.id,
      isTemplate,
      isWorkspaceTemplate,
      new Date()
    );

    const updatedFile = await db.project.getProjectFileByPath(ws, projectId, filePath);
    return toApiProjectFile(updatedFile!);
  } catch (e) {
    return handleError(e, 'Failed to update template status');
  }
};
