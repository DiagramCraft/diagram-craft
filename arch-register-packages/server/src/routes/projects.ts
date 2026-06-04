import { H3, H3Event, HTTPError, defineHandler } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../db/database.js';
import type { ProjectFile } from '../types.js';
import type { StorageAdapter } from '../storage/storage.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handleDbError } from '../utils/http.js';
import {
  buildApiAuthCtx,
  canAccessProject,
  requireCanCreateProject,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { toApiProject, toApiProjectFile, toApiProjectDetail } from '../api/transforms.js';
import type { FileTree } from '@arch-register/api-types';
import { generateSvgPreview } from '../preview/svgPreviewGenerator.js';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { getDiagramCommentCounts } from '../diagrams/commentCounts.js';

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

const buildFileTree = (files: ProjectFile[]): FileTree => {
  const rootFiles = files
    .filter(f => f.path.indexOf('/') === -1)
    .map(toApiProjectFile);

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

export const createProjectRoutes = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      try {
        const projects = await db.projectsFiles.listProjects(workspace);
        const visibleProjects = projects.filter(project =>
          canAccessProject(authCtx, project.owner)
        );
        const fileCounts = new Map<string, number>();
        const projectFiles = await Promise.all(
          visibleProjects.map(project => db.projectsFiles.listProjectFiles(workspace, project.id))
        );
        for (const files of projectFiles) {
          for (const file of files) {
            fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
          }
        }
        return visibleProjects
          .map(project =>
            toApiProject(project, fileCounts.get(project.id) ?? 0, authCtx)
          )
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = getParam(event, 'id');
      try {
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const files = await db.projectsFiles.listProjectFiles(workspace, id);

        return toApiProjectDetail(project, buildFileTree(files), authCtx);
      } catch (e) {
        handleError(e, 'Failed to retrieve project');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { name, description = '', owner, status, color } = body as Record<string, unknown>;
      httpAssert.present(name, { message: 'name is required' });
      const projectStatus = parseProjectStatus(status);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const teamIds = new Set((await db.workspaceAdmin.listTeams(workspace)).map(row => row.id));
        const resolvedOwner = resolveProjectOwner(owner, teamIds);
        if (authCtx)
          requireCanCreateProject(
            authCtx,
            resolvedOwner,
            'You do not have permission to create a project for this owner team'
          );
        const timestamp = new Date();
        const row = await db.projectsFiles.createProject({
          id: randomUUID(),
          workspace,
          name: name as string,
          description: typeof description === 'string' ? description : '',
          owner: resolvedOwner,
          status: projectStatus,
          color: typeof color === 'string' ? color : null,
          created_at: timestamp,
          updated_at: timestamp
        });

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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { name, description, owner, status, color } = body as Record<string, unknown>;
      httpAssert.present(name, { message: 'name is required' });
      const projectStatus = status === undefined ? undefined : parseProjectStatus(status);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const oldRow = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Project '${id}' not found` });
        const teamIds = new Set((await db.workspaceAdmin.listTeams(workspace)).map(row => row.id));
        const resolvedOwner =
          owner !== undefined ? resolveProjectOwner(owner, teamIds) : oldRow.owner;
        if (authCtx) {
          requireProjectAction(
            authCtx,
            oldRow.owner,
            'edit_project',
            'You do not have permission to edit this project'
          );
          if (resolvedOwner !== oldRow.owner) {
            requireProjectAction(
              authCtx,
              resolvedOwner,
              'edit_project',
              'You do not have permission to transfer this project to the target owner team'
            );
          }
        }

        const row = await db.projectsFiles.updateProject(workspace, id, {
          name: name as string,
          description:
            description !== undefined
              ? typeof description === 'string'
                ? description
                : ''
              : oldRow.description,
          owner: resolvedOwner,
          status: projectStatus ?? oldRow.status,
          color: color !== undefined ? (typeof color === 'string' ? color : null) : oldRow.color,
          updated_at: new Date()
        });

                const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));

                await logAudit(db, {

                  workspace,

                  operation: 'update',

                  entityType: 'project',

                  entityId: id,

                  entityName: row!.name,

                  changes

                });

        

                const fileCount = (await db.projectsFiles.listProjectFiles(workspace, id)).length;

                return toApiProject(row!, fileCount, authCtx);
      } catch (e) {
        handleError(e, 'Failed to update project');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'delete_project',
            'You do not have permission to delete this project'
          );

        await db.projectsFiles.deleteProject(workspace, id);

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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const files = await db.projectsFiles.listProjectFiles(workspace, id);
        return buildFileTree(files);
      } catch (e) {
        handleError(e, 'Failed to list files');
      }
    })
  );

  router.get(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const file = await db.projectsFiles.getProjectFileByPath(workspace, id, filePath);
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
      const workspace = await resolveWorkspace(event, db);
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
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const existingFile = await db.projectsFiles.getProjectFileByPath(workspace, id, filePath);
        const isUpdate = !!existingFile;

        const timestamp = new Date();
        const row = await db.projectsFiles.upsertProjectFile({
          workspace,
          project_id: id,
          path: filePath,
          name: String(displayName),
          size_bytes: content.length,
          created_atIfNew: existingFile?.created_at ?? timestamp,
          updated_at: timestamp
        });

        await storage.write(workspace, id, row.id, content);

        try {
          const previewSvg = generateSvgPreview(body as SerializedDiagramDocument);
          if (previewSvg) {
            await db.projectsFiles.updateProjectFilePreview(workspace, id, row.id, previewSvg);
          }
        } catch {
          // Preview generation is best-effort — don't fail the save
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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const file = await db.projectsFiles.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

        await db.projectsFiles.deleteProjectFileByPath(workspace, id, filePath);

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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be valid JSON' });

      const { newPath } = body as Record<string, unknown>;
      httpAssert.string(newPath, { message: 'newPath is required' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });

        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );

        const existingFile = await db.projectsFiles.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

        // Check if source and target are the same
        if (filePath === newPath) {
          return existingFile;
        }

        // Check if target path already exists
        const targetExists = await db.projectsFiles.getProjectFileByPath(workspace, id, newPath);
        httpAssert.true(!targetExists, {
          status: 409,
          message: `A file already exists at '${newPath}'`
        });

        // Read file content
        const content = await storage.read(workspace, id, existingFile.id);
        const fileData = JSON.parse(content.toString('utf8'));

        // Update internal name if filename changed
        const newFileName = newPath.includes('/')
          ? newPath.substring(newPath.lastIndexOf('/') + 1)
          : newPath;
        const displayName = newFileName.endsWith('.json')
          ? newFileName.slice(0, -5)
          : newFileName;

        if (fileData && typeof fileData === 'object' && 'name' in fileData) {
          fileData.name = displayName;
        }

        const timestamp = new Date();

        // Create at new path
        const newFile = await db.projectsFiles.upsertProjectFile({
          workspace,
          project_id: id,
          path: newPath,
          name: displayName,
          size_bytes: content.length,
          created_atIfNew: existingFile.created_at,
          updated_at: timestamp
        });

        // Preserve template flags
        if (existingFile.is_template || existingFile.is_workspace_template) {
          await db.projectsFiles.updateProjectFileTemplateStatus(
            workspace,
            id,
            newFile.id,
            existingFile.is_template ?? false,
            existingFile.is_workspace_template ?? false,
            timestamp
          );
        }

        // Write updated content to storage
        await storage.write(workspace, id, newFile.id, Buffer.from(JSON.stringify(fileData), 'utf8'));

        // Delete old file
        await db.projectsFiles.deleteProjectFileByPath(workspace, id, filePath);
        await storage.delete(workspace, id, existingFile.id).catch(() => {});

        // Determine operation type for audit log
        const oldFolder = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : null;
        const newFolder = newPath.includes('/') ? newPath.substring(0, newPath.lastIndexOf('/')) : null;
        const oldName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;
        const newName = newPath.includes('/') ? newPath.substring(newPath.lastIndexOf('/') + 1) : newPath;

        const isMoved = oldFolder !== newFolder;
        const isRenamed = oldName !== newName;
        const operation = isMoved && isRenamed ? 'move_rename' : isMoved ? 'move' : 'rename';

        await logAudit(db, {
          workspace,
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
            operation,
            from_folder: oldFolder,
            to_folder: newFolder
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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { path: folderPath } = body as Record<string, unknown>;
      httpAssert.string(folderPath, { message: 'path is required' });

      const markerPath = `${folderPath}/.keep`;
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const timestamp = new Date();
        const row = await db.projectsFiles.createProjectFileIfAbsent({
          workspace,
          project_id: id,
          path: markerPath,
          name: '.keep',
          size_bytes: 0,
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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { oldPath, newPath } = body as Record<string, unknown>;
      httpAssert.string(oldPath, { message: 'oldPath and newPath are required strings' });
      httpAssert.string(newPath, { message: 'oldPath and newPath are required strings' });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.projectsFiles.renameProjectFileFolder(
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
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const folderPath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, id);
        httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.projectsFiles.deleteProjectFileFolder(workspace, id, folderPath);

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
