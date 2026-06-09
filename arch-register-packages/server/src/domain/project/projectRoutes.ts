import { H3, H3Event, HTTPError, defineHandler } from 'h3';
import { randomUUID } from 'node:crypto';
import type { CreateProjectInput, DatabaseAdapter, UpdateProjectInput } from '../../db/database';
import type { ProjectFile } from '../../types';
import type { StorageAdapter } from '../../storage/storage';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { handleDbError } from '../../utils/http';
import {
  buildApiAuthCtx,
  canAccessProject,
  requireCanCreateProject,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { toApiProject, toApiProjectFile, toApiProjectDetail } from './projectHelpers';
import type { FileTree } from '@arch-register/api-types';
import { generateSvgPreview } from '../diagram/svgPreviewGenerator';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { getDiagramCommentCounts } from '../diagram/commentCounts';

const BASE = '/api/:workspace/projects';
const PROJECT_STATUSES = ['pinned', 'active', 'archived'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A project with that name already exists in this workspace',
    foreign: 'Foreign key constraint violation'
  });

const getParam = (event: H3Event, name: string) => {
  const value = event.context.params?.[name];
  httpAssert.present(value, { message: `${name} is required` });
  return decodeURIComponent(value);
};

export const parseProjectStatus = (value: unknown): ProjectStatus => {
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

export const resolveProjectOwner = (owner: unknown, teamIds: Set<string>) =>
  typeof owner === 'string' && teamIds.has(owner) ? owner : null;

export const buildFileTree = (files: ProjectFile[]): FileTree => {
  const rootFiles = files.filter(f => f.path.indexOf('/') === -1).map(toApiProjectFile);

  const folderMap = new Map<string, ProjectFile[]>();

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

export const buildCreateProjectInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date
): CreateProjectInput => {
  const { name, description = '', owner, status, color } = body;
  httpAssert.present(name, { message: 'name is required' });

  return {
    id: randomUUID(),
    workspace,
    name: name as string,
    description: typeof description === 'string' ? description : '',
    owner: resolveProjectOwner(owner, teamIds),
    status: parseProjectStatus(status),
    color: typeof color === 'string' ? color : null,
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateProjectInput = (
  body: Record<string, unknown>,
  existing: UpdateProjectInput & { owner: string | null },
  teamIds: Set<string>,
  updatedAt: Date
) => {
  const { name, description, owner, status, color } = body;
  httpAssert.present(name, { message: 'name is required' });
  const projectStatus = status === undefined ? undefined : parseProjectStatus(status);

  return {
    owner: owner !== undefined ? resolveProjectOwner(owner, teamIds) : existing.owner,
    input: {
      name: name as string,
      description:
        description !== undefined
          ? typeof description === 'string'
            ? description
            : ''
          : existing.description,
      owner: owner !== undefined ? resolveProjectOwner(owner, teamIds) : existing.owner,
      status: projectStatus ?? existing.status,
      color: color !== undefined ? (typeof color === 'string' ? color : null) : existing.color,
      updated_at: updatedAt
    } satisfies UpdateProjectInput
  };
};

export const describeProjectFileRelocation = (oldPath: string, newPath: string) => {
  const oldFolder = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : null;
  const newFolder = newPath.includes('/') ? newPath.substring(0, newPath.lastIndexOf('/')) : null;
  const oldName = oldPath.includes('/') ? oldPath.substring(oldPath.lastIndexOf('/') + 1) : oldPath;
  const newName = newPath.includes('/') ? newPath.substring(newPath.lastIndexOf('/') + 1) : newPath;

  const isMoved = oldFolder !== newFolder;
  const isRenamed = oldName !== newName;

  return {
    oldFolder,
    newFolder,
    displayName: newName.endsWith('.json') ? newName.slice(0, -5) : newName,
    operation: isMoved && isRenamed ? 'move_rename' : isMoved ? 'move' : 'rename'
  };
};

export const createProjectRoutes = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      try {
        const projects = await db.project.listProjects(workspace);
        const visibleProjects = projects.filter(project =>
          canAccessProject(authCtx, project.owner)
        );
        const fileCounts = new Map<string, number>();
        const projectFiles = await Promise.all(
          visibleProjects.map(project => db.project.listProjectFiles(workspace, project.id))
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
        handleError(e, 'Failed to retrieve projects');
      }
    })
  );

  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = getParam(event, 'id');
      try {
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const files = await db.project.listProjectFiles(workspace, id);

        return toApiProjectDetail(project, buildFileTree(files), authCtx);
      } catch (e) {
        handleError(e, 'Failed to retrieve project');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const teamIds = new Set((await db.workspace.listTeams(workspace)).map(row => row.id));
        const timestamp = new Date();
        const input = buildCreateProjectInput(
          workspace,
          body as Record<string, unknown>,
          teamIds,
          timestamp
        );
        if (authCtx)
          requireCanCreateProject(
            authCtx,
            input.owner,
            'You do not have permission to create a project for this owner team'
          );
        const row = await db.project.createProject(input);

        await logAudit(db, {
          workspace,
          operation: 'create',
          entityType: 'project',
          entityId: row.id,
          entityName: row.name,
          changes: {
            new: extractEntityFields(row)
          }
        });

        return toApiProject(row, 0, authCtx);
      } catch (e) {
        handleError(e, 'Failed to create project');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const oldRow = await db.project.getProject(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Project '${id}' not found` });
        const teamIds = new Set((await db.workspace.listTeams(workspace)).map(row => row.id));
        const update = buildUpdateProjectInput(
          body as Record<string, unknown>,
          oldRow,
          teamIds,
          new Date()
        );
        if (authCtx) {
          requireProjectAction(
            authCtx,
            oldRow.owner,
            'edit_project',
            'You do not have permission to edit this project'
          );
          if (update.owner !== oldRow.owner) {
            requireProjectAction(
              authCtx,
              update.owner,
              'edit_project',
              'You do not have permission to transfer this project to the target owner team'
            );
          }
        }

        const row = await db.project.updateProject(workspace, id, update.input);
        httpAssert.present(row, { status: 404, message: `Project '${id}' not found` });

        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'project',
          entityId: id,
          entityName: row.name,
          changes
        });

        const fileCount = (await db.project.listProjectFiles(workspace, id)).length;

        return toApiProject(row, fileCount, authCtx);
      } catch (e) {
        handleError(e, 'Failed to update project');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'delete_project',
            'You do not have permission to delete this project'
          );

        await db.project.deleteProject(workspace, id);

        await logAudit(db, {
          workspace,
          operation: 'delete',
          entityType: 'project',
          entityId: id,
          entityName: project.name,
          changes: {
            old: extractEntityFields(project)
          }
        });

        await storage.deleteAll(workspace, id).catch(() => {});

        return { success: true, message: `Project '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete project');
      }
    })
  );

  router.get(
    `${BASE}/:id/files`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const files = await db.project.listProjectFiles(workspace, id);
        return buildFileTree(files);
      } catch (e) {
        handleError(e, 'Failed to list files');
      }
    })
  );

  router.get(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const file = await db.project.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

        const content = await storage.read(workspace, id, file.id);
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
        handleError(e, 'Failed to read file');
      }
    })
  );

  router.put(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be valid JSON' });

      const content = Buffer.from(JSON.stringify(body), 'utf8');
      const fileName = filePath.includes('/')
        ? filePath.substring(filePath.lastIndexOf('/') + 1)
        : filePath;

      const displayName =
        (body as Record<string, unknown>)['name'] ??
        (fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const existingFile = await db.project.getProjectFileByPath(workspace, id, filePath);
        const isUpdate = !!existingFile;

        const timestamp = new Date();
        const commentCounts = getDiagramCommentCounts(body as SerializedDiagramDocument);
        const row = await db.project.upsertProjectFile({
          workspace,
          project_id: id,
          path: filePath,
          name: String(displayName),
          size_bytes: content.length,
          comment_count: commentCounts.commentCount,
          unresolved_comment_count: commentCounts.unresolvedCommentCount,
          created_atIfNew: existingFile?.created_at ?? timestamp,
          updated_at: timestamp
        });

        await storage.write(workspace, id, row.id, content);

        try {
          const previewSvg = generateSvgPreview(body as SerializedDiagramDocument);
          await db.project.updateProjectFileDerivedData(
            workspace,
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
            workspace,
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
          const changes = computeChanges(
            extractEntityFields(existingFile),
            extractEntityFields(row)
          );
          await logAudit(db, {
            workspace,
            operation: 'update',
            entityType: 'project_file',
            entityId: row.id,
            entityName: row.name,
            changes,
            metadata: { project_id: id, path: filePath }
          });
        } else {
          await logAudit(db, {
            workspace,
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

        return row;
      } catch (e) {
        handleError(e, 'Failed to write file');
      }
    })
  );

  router.delete(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const file = await db.project.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

        await db.project.deleteProjectFileByPath(workspace, id, filePath);

        await logAudit(db, {
          workspace,
          operation: 'delete',
          entityType: 'project_file',
          entityId: file.id,
          entityName: file.name,
          changes: {
            old: extractEntityFields(file)
          },
          metadata: { project_id: id, path: filePath }
        });

        await storage.delete(workspace, id, file.id).catch(() => {});

        return { success: true, message: `File '${filePath}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete file');
      }
    })
  );

  router.put(
    `${BASE}/:id/files/relocate/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be valid JSON' });

      const { newPath } = body as Record<string, unknown>;
      httpAssert.string(newPath, { message: 'newPath is required' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });

        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const existingFile = await db.project.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

        // Check if source and target are the same
        if (filePath === newPath) {
          return existingFile;
        }

        // Check if target path already exists
        const targetExists = await db.project.getProjectFileByPath(workspace, id, newPath);
        httpAssert.true(!targetExists, {
          status: 409,
          message: `A file already exists at '${newPath}'`
        });

        // Read file content
        const content = await storage.read(workspace, id, existingFile.id);
        const fileData = JSON.parse(content.toString('utf8'));

        const relocation = describeProjectFileRelocation(filePath, newPath);

        if (fileData && typeof fileData === 'object' && 'name' in fileData) {
          fileData.name = relocation.displayName;
        }

        const timestamp = new Date();
        const updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
        const commentCounts = getDiagramCommentCounts(fileData as SerializedDiagramDocument);

        // Create at new path
        const newFile = await db.project.upsertProjectFile({
          workspace,
          project_id: id,
          path: newPath,
          name: relocation.displayName,
          size_bytes: updatedContent.length,
          comment_count: commentCounts.commentCount,
          unresolved_comment_count: commentCounts.unresolvedCommentCount,
          created_atIfNew: existingFile.created_at,
          updated_at: timestamp
        });

        // Preserve template flags
        if (existingFile.is_template || existingFile.is_workspace_template) {
          await db.project.updateProjectFileTemplateStatus(
            workspace,
            id,
            newFile.id,
            existingFile.is_template ?? false,
            existingFile.is_workspace_template ?? false,
            timestamp
          );
        }

        let previewSvg: string | null = null;
        try {
          previewSvg = generateSvgPreview(fileData as SerializedDiagramDocument) ?? null;
        } catch {
          previewSvg = null;
        }
        await db.project.updateProjectFileDerivedData(
          workspace,
          id,
          newFile.id,
          updatedContent.length,
          commentCounts.commentCount,
          commentCounts.unresolvedCommentCount,
          previewSvg,
          timestamp
        );

        // Write updated content to storage
        await storage.write(workspace, id, newFile.id, updatedContent);

        // Delete old file
        await db.project.deleteProjectFileByPath(workspace, id, filePath);
        await storage.delete(workspace, id, existingFile.id).catch(() => {});

        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'project_file',
          entityId: newFile.id,
          entityName: relocation.displayName,
          changes: {
            old: { path: filePath, name: existingFile.name },
            new: { path: newPath, name: relocation.displayName }
          },
          metadata: {
            project_id: id,
            operation: relocation.operation,
            from_folder: relocation.oldFolder,
            to_folder: relocation.newFolder
          }
        });

        return newFile;
      } catch (e) {
        handleError(e, 'Failed to relocate file');
      }
    })
  );

  router.post(
    `${BASE}/:id/folders`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { path: folderPath } = body as Record<string, unknown>;
      httpAssert.string(folderPath, { message: 'path is required' });

      const markerPath = `${folderPath}/.keep`;
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const timestamp = new Date();
        const row = await db.project.createProjectFileIfAbsent({
          workspace,
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
          await storage.write(workspace, id, row.id, Buffer.alloc(0));
        }

        if (row) {
          await logAudit(db, {
            workspace,
            operation: 'create',
            entityType: 'project_file',
            entityId: row.id,
            entityName: folderPath,
            changes: {
              new: { path: folderPath, type: 'folder' }
            },
            metadata: { project_id: id, path: folderPath, is_folder: true }
          });
        }

        return { success: true, path: folderPath, marker: row ?? null };
      } catch (e) {
        handleError(e, 'Failed to create folder');
      }
    })
  );

  router.put(
    `${BASE}/:id/folders/rename`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { oldPath, newPath } = body as Record<string, unknown>;
      httpAssert.string(oldPath, { message: 'oldPath and newPath are required strings' });
      httpAssert.string(newPath, { message: 'oldPath and newPath are required strings' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.project.renameProjectFileFolder(
          workspace,
          id,
          oldPath,
          newPath,
          new Date()
        );

        httpAssert.true(result.length > 0, {
          status: 404,
          message: `No files found under folder '${oldPath}'`
        });

        return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
      } catch (e) {
        handleError(e, 'Failed to rename folder');
      }
    })
  );

  router.delete(
    `${BASE}/:id/folders/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const id = getParam(event, 'id');
      const folderPath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.project.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.project.deleteProjectFileFolder(workspace, id, folderPath);

        httpAssert.true(result.length > 0, {
          status: 404,
          message: `No files found under folder '${folderPath}'`
        });

        await Promise.all(
          result.map(file => storage.delete(workspace, id, file.id).catch(() => {}))
        );
        return { success: true, message: `Deleted ${result.length} file(s)`, count: result.length };
      } catch (e) {
        handleError(e, 'Failed to delete folder');
      }
    })
  );

  return router;
};
