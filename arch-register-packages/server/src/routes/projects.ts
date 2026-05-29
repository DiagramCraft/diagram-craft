import { H3, H3Event, HTTPError, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { ProjectFile } from '../types.js';
import type { StorageAdapter } from '../storage/storage.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handleDbError } from '../utils/http.js';
import { buildApiAuthCtx, requireProjectAction, requireCanCreateProject } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import {
  AuthorizationContext,
  PermissionEvaluator,
  ProjectCapabilities
} from '@arch-register/permissions';

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
  if (!value)
    throw new HTTPError({ status: 400, statusText: 'Bad Request', message: `${name} is required` });
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

const getProjectCapabilities = (
  context: AuthorizationContext | null,
  ownerTeamId: string | null
): ProjectCapabilities => {
  if (!context) {
    return {
      canEdit: true,
      canDelete: true,
      canManageFiles: true
    };
  }

  const evaluator = new PermissionEvaluator();
  return {
    canEdit: evaluator.hasProjectPermission(context, ownerTeamId, 'edit_project'),
    canDelete: evaluator.hasProjectPermission(context, ownerTeamId, 'delete_project'),
    canManageFiles: evaluator.hasProjectPermission(context, ownerTeamId, 'manage_files')
  };
};

const resolveProjectOwner = (owner: unknown, ownerValues: Set<string>) =>
  typeof owner === 'string' && ownerValues.has(owner) ? owner : null;

type FileEntry = {
  id: string;
  path: string;
  name: string;
  size_bytes: number;
  created_at: Date;
  updated_at: Date;
};

type FileTreeResponse = {
  folders: Array<{ path: string; files: FileEntry[] }>;
  rootFiles: FileEntry[];
};

const buildFileTree = (files: ProjectFile[]): FileTreeResponse => {
  const rootFiles: FileEntry[] = [];
  const folderMap = new Map<string, FileEntry[]>();

  for (const f of files) {
    const entry: FileEntry = {
      id: f.id,
      path: f.path,
      name: f.name,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
      updated_at: f.updated_at
    };

    const lastSlash = f.path.lastIndexOf('/');
    if (lastSlash === -1) {
      rootFiles.push(entry);
    } else {
      const folder = f.path.substring(0, lastSlash);
      const existing = folderMap.get(folder);
      if (existing) {
        existing.push(entry);
      } else {
        folderMap.set(folder, [entry]);
      }
    }
  }

  const folders = Array.from(folderMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, files]) => ({ path, files }));

  return { folders, rootFiles };
};

const toProjectResponse = <T extends { owner: string | null }>(
  project: T,
  authCtx: AuthorizationContext
) => ({
  ...project,
  ...getProjectCapabilities(authCtx, project.owner)
});

export const createProjectRoutes = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const router = new H3();

  // ── Project CRUD ────────────────────────────────────────────────

  // GET /api/:workspace/projects
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      try {
        const projects = await db.listProjects(workspace);
        const fileCounts = new Map<string, number>();
        const projectFiles = await Promise.all(
          projects.map(project => db.listProjectFiles(workspace, project.id))
        );
        for (const files of projectFiles) {
          for (const file of files) {
            fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
          }
        }
        return projects
          .map(project =>
            toProjectResponse({ ...project, file_count: fileCounts.get(project.id) ?? 0 }, authCtx)
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

  // GET /api/:workspace/projects/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = getParam(event, 'id');
      try {
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });

        const files = await db.listProjectFiles(workspace, id);

        return toProjectResponse({ ...project, files: buildFileTree(files) }, authCtx);
      } catch (e) {
        handleError(e, 'Failed to retrieve project');
      }
    })
  );

  // POST /api/:workspace/projects
  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const { name, description = '', owner, status } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required'
        });
      const projectStatus = parseProjectStatus(status);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const ownerValues = new Set((await db.listOwners(workspace)).map(row => row.id));
        const resolvedOwner = resolveProjectOwner(owner, ownerValues);
        if (authCtx)
          requireCanCreateProject(
            authCtx,
            resolvedOwner,
            'You do not have permission to create a project for this owner team'
          );
        const timestamp = new Date();
        const row = await db.createProject({
          id: crypto.randomUUID(),
          workspace,
          name: name as string,
          description: typeof description === 'string' ? description : '',
          owner: resolvedOwner,
          status: projectStatus,
          created_at: timestamp,
          updated_at: timestamp
        });

        // Log audit entry
        await logAudit(db, {
          workspace,
          operation: 'create',
          entityType: 'project',
          entityId: row!.id,
          entityName: row!.name,
          changes: {
            new: extractEntityFields(row!)
          }
        });

        return toProjectResponse(row!, authCtx);
      } catch (e) {
        handleError(e, 'Failed to create project');
      }
    })
  );

  // PUT /api/:workspace/projects/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const { name, description, owner, status } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required'
        });
      const projectStatus = status === undefined ? undefined : parseProjectStatus(status);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        // Fetch old state for audit log
        const oldRow = await db.getProject(workspace, id);
        if (!oldRow)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        const ownerValues = new Set((await db.listOwners(workspace)).map(row => row.id));
        const resolvedOwner =
          owner !== undefined ? resolveProjectOwner(owner, ownerValues) : oldRow.owner;
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

        const row = await db.updateProject(workspace, id, {
          name: name as string,
          description:
            description !== undefined
              ? typeof description === 'string'
                ? description
                : ''
              : oldRow.description,
          owner: resolvedOwner,
          status: projectStatus ?? oldRow.status,
          updated_at: new Date()
        });

        // Log audit entry with field-level changes
        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));

        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'project',
          entityId: id,
          entityName: row!.name,
          changes
        });

        return toProjectResponse(row!, authCtx);
      } catch (e) {
        handleError(e, 'Failed to update project');
      }
    })
  );

  // DELETE /api/:workspace/projects/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        // Fetch project before deletion for audit log
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'delete_project',
            'You do not have permission to delete this project'
          );

        // Delete project
        await db.deleteProject(workspace, id);

        // Log audit entry
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

        // Clean up storage (orphaned files on disk are harmless if this fails)
        await storage.deleteAll(workspace, id).catch(() => {});

        return { success: true, message: `Project '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete project');
      }
    })
  );

  // ── File operations ─────────────────────────────────────────────

  // GET /api/:workspace/projects/:id/files — list file tree
  router.get(
    `${BASE}/:id/files`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      try {
        const files = await db.listProjectFiles(workspace, id);
        return buildFileTree(files);
      } catch (e) {
        handleError(e, 'Failed to list files');
      }
    })
  );

  // GET /api/:workspace/projects/:id/files/** — download file content
  router.get(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const file = await db.getProjectFileByPath(workspace, id, filePath);
        if (!file)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `File '${filePath}' not found`
          });

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

  // PUT /api/:workspace/projects/:id/files/** — upload/update file
  router.put(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      if (body == null)
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be valid JSON'
        });

      const content = Buffer.from(JSON.stringify(body), 'utf8');
      const fileName = filePath.includes('/')
        ? filePath.substring(filePath.lastIndexOf('/') + 1)
        : filePath;

      // Strip .json extension for display name
      const displayName =
        (body as Record<string, unknown>)['name'] ??
        (fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        // Check if file exists for audit log
        const existingFile = await db.getProjectFileByPath(workspace, id, filePath);
        const isUpdate = !!existingFile;

        // Upsert file metadata
        const timestamp = new Date();
        const row = await db.upsertProjectFile({
          workspace,
          project_id: id,
          path: filePath,
          name: String(displayName),
          size_bytes: content.length,
          created_atIfNew: existingFile?.created_at ?? timestamp,
          updated_at: timestamp
        });

        // Write to storage
        await storage.write(workspace, id, row.id, content);

        // Log audit entry
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

  // DELETE /api/:workspace/projects/:id/files/** — delete file
  router.delete(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        // Fetch file before deletion for audit log
        const file = await db.getProjectFileByPath(workspace, id, filePath);
        if (!file)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `File '${filePath}' not found`
          });

        // Delete file
        await db.deleteProjectFileByPath(workspace, id, filePath);

        // Log audit entry
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

  // ── Folder operations ───────────────────────────────────────────

  // POST /api/:workspace/projects/:id/folders — create folder (via .keep marker)
  router.post(
    `${BASE}/:id/folders`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const { path: folderPath } = body as Record<string, unknown>;
      if (!folderPath || typeof folderPath !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'path is required'
        });

      const markerPath = `${folderPath}/.keep`;
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const timestamp = new Date();
        const row = await db.createProjectFileIfAbsent({
          workspace,
          project_id: id,
          path: markerPath,
          name: '.keep',
          size_bytes: 0,
          created_atIfNew: timestamp,
          updated_at: timestamp
        });

        // Write empty marker to storage
        if (row) {
          await storage.write(workspace, id, row.id, Buffer.alloc(0));
        }

        // Log audit entry for folder creation (if marker was created)
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

  // PUT /api/:workspace/projects/:id/folders/rename — rename folder
  router.put(
    `${BASE}/:id/folders/rename`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const { oldPath, newPath } = body as Record<string, unknown>;
      if (!oldPath || typeof oldPath !== 'string' || !newPath || typeof newPath !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'oldPath and newPath are required strings'
        });

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.renameProjectFileFolder(
          workspace,
          id,
          oldPath,
          newPath,
          new Date()
        );

        if (result.length === 0)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `No files found under folder '${oldPath}'`
          });

        return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
      } catch (e) {
        handleError(e, 'Failed to rename folder');
      }
    })
  );

  // DELETE /api/:workspace/projects/:id/folders/** — delete folder and all contained files
  router.delete(
    `${BASE}/:id/folders/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const id = getParam(event, 'id');
      const folderPath = getParam(event, 'path');
      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.getProject(workspace, id);
        if (!project)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Project '${id}' not found`
          });
        if (authCtx)
          requireProjectAction(
            authCtx,
            project.owner,
            'edit_project',
            'You do not have permission to modify this project'
          );
        const result = await db.deleteProjectFileFolder(workspace, id, folderPath);

        if (result.length === 0)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
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
