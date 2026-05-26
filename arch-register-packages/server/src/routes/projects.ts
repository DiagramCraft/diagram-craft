import { H3, H3Event, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { Project, ProjectFile } from '../types.js';
import type { StorageAdapter } from '../storage/storage.js';

const BASE = '/api/:workspace/projects';
const PROJECT_STATUSES = ['pinned', 'active', 'archived'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (HTTPError.isError(error)) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23505') {
      throw new HTTPError({
        status: 409,
        statusText: 'Conflict',
        message: 'A project with that name already exists in this workspace'
      });
    }
    if (code === '23503') {
      throw new HTTPError({
        status: 409,
        statusText: 'Conflict',
        message: 'Foreign key constraint violation'
      });
    }
  }
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

const getWorkspace = (event: H3Event) => {
  const workspace = event.context.params?.['workspace'];
  if (!workspace) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'workspace is required' });
  return workspace;
};

const getParam = (event: H3Event, name: string) => {
  const value = event.context.params?.[name];
  if (!value) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: `${name} is required` });
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

export const createProjectRoutes = (storage: StorageAdapter) => {
  const router = new H3();

  // ── Project CRUD ────────────────────────────────────────────────

  // GET /api/:workspace/projects
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      try {
        return await sql<(Project & { file_count: number })[]>`
          SELECT p.*, COALESCE(c.cnt, 0)::int AS file_count
          FROM project p
          LEFT JOIN (
            SELECT project_id, COUNT(*) AS cnt FROM project_file WHERE workspace = ${workspace} GROUP BY project_id
          ) c ON c.project_id = p.id
          WHERE p.workspace = ${workspace}
          ORDER BY
            CASE p.status
              WHEN 'pinned' THEN 0
              WHEN 'active' THEN 1
              ELSE 2
            END,
            p.name
        `;
      } catch (e) {
        handleError(e, 'Failed to retrieve projects');
      }
    })
  );

  // GET /api/:workspace/projects/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      try {
        const [project] = await sql<Project[]>`
          SELECT * FROM project WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!project)
          throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Project '${id}' not found` });

        const files = await sql<ProjectFile[]>`
          SELECT * FROM project_file WHERE workspace = ${workspace} AND project_id = ${id} ORDER BY path
        `;

        return { ...project, files: buildFileTree(files) };
      } catch (e) {
        handleError(e, 'Failed to retrieve project');
      }
    })
  );

  // POST /api/:workspace/projects
  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { name, description = '', status } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required' });
      const projectStatus = parseProjectStatus(status);

      try {
        const [row] = await sql<Project[]>`
          INSERT INTO project (workspace, name, description, status)
          VALUES (${workspace}, ${name}, ${typeof description === 'string' ? description : ''}, ${projectStatus})
          RETURNING *
        `;
        return row!;
      } catch (e) {
        handleError(e, 'Failed to create project');
      }
    })
  );

  // PUT /api/:workspace/projects/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { name, description, status } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required' });
      const projectStatus = status === undefined ? undefined : parseProjectStatus(status);

      try {
        const [row] = await sql<Project[]>`
          UPDATE project SET
            name        = ${name},
            description = ${description !== undefined ? (typeof description === 'string' ? description : '') : sql`description`},
            status      = ${projectStatus ?? sql`status`}
          WHERE workspace = ${workspace} AND id = ${id}
          RETURNING *
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Project '${id}' not found` });
        return row;
      } catch (e) {
        handleError(e, 'Failed to update project');
      }
    })
  );

  // DELETE /api/:workspace/projects/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      try {
        const [row] = await sql<Project[]>`
          DELETE FROM project WHERE workspace = ${workspace} AND id = ${id} RETURNING id
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Project '${id}' not found` });

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
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      try {
        const files = await sql<ProjectFile[]>`
          SELECT * FROM project_file WHERE workspace = ${workspace} AND project_id = ${id} ORDER BY path
        `;
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
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const content = await storage.read(workspace, id, filePath);
        return JSON.parse(content.toString('utf8'));
      } catch (e) {
        if (e != null && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ENOENT') {
          throw new HTTPError({ status: 404, statusText: 'Not Found', message: `File '${filePath}' not found` });
        }
        handleError(e, 'Failed to read file');
      }
    })
  );

  // PUT /api/:workspace/projects/:id/files/** — upload/update file
  router.put(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      if (body == null)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be valid JSON' });

      const content = Buffer.from(JSON.stringify(body), 'utf8');
      const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;

      // Strip .json extension for display name
      const displayName =
        (body as Record<string, unknown>)['name'] ??
        (fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName);

      try {
        // Upsert file metadata
        const [row] = await sql<ProjectFile[]>`
          INSERT INTO project_file (workspace, project_id, path, name, size_bytes)
          VALUES (${workspace}, ${id}, ${filePath}, ${String(displayName)}, ${content.length})
          ON CONFLICT (workspace, project_id, path)
          DO UPDATE SET name = ${String(displayName)}, size_bytes = ${content.length}
          RETURNING *
        `;

        // Write to storage
        await storage.write(workspace, id, filePath, content);

        return row!;
      } catch (e) {
        handleError(e, 'Failed to write file');
      }
    })
  );

  // DELETE /api/:workspace/projects/:id/files/** — delete file
  router.delete(
    `${BASE}/:id/files/**:path`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const filePath = getParam(event, 'path');
      try {
        const [row] = await sql<ProjectFile[]>`
          DELETE FROM project_file
          WHERE workspace = ${workspace} AND project_id = ${id} AND path = ${filePath}
          RETURNING id
        `;
        if (!row)
          throw new HTTPError({ status: 404, statusText: 'Not Found', message: `File '${filePath}' not found` });

        await storage.delete(workspace, id, filePath).catch(() => {});

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
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { path: folderPath } = body as Record<string, unknown>;
      if (!folderPath || typeof folderPath !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'path is required' });

      const markerPath = `${folderPath}/.keep`;
      try {
        const [row] = await sql<ProjectFile[]>`
          INSERT INTO project_file (workspace, project_id, path, name, size_bytes)
          VALUES (${workspace}, ${id}, ${markerPath}, ${'.keep'}, ${0})
          ON CONFLICT (workspace, project_id, path) DO NOTHING
          RETURNING *
        `;

        // Write empty marker to storage
        await storage.write(workspace, id, markerPath, Buffer.alloc(0));

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
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { oldPath, newPath } = body as Record<string, unknown>;
      if (!oldPath || typeof oldPath !== 'string' || !newPath || typeof newPath !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'oldPath and newPath are required strings'
        });

      try {
        const result = await sql`
          UPDATE project_file
          SET path = ${newPath} || substring(path from ${oldPath.length + 1})
          WHERE workspace = ${workspace} AND project_id = ${id} AND path LIKE ${oldPath + '/%'}
          RETURNING id
        `;

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
      const workspace = getWorkspace(event);
      const id = getParam(event, 'id');
      const folderPath = getParam(event, 'path');
      try {
        const result = await sql`
          DELETE FROM project_file
          WHERE workspace = ${workspace} AND project_id = ${id} AND path LIKE ${folderPath + '/%'}
          RETURNING id
        `;

        if (result.length === 0)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `No files found under folder '${folderPath}'`
          });

        return { success: true, message: `Deleted ${result.length} file(s)`, count: result.length };
      } catch (e) {
        handleError(e, 'Failed to delete folder');
      }
    })
  );

  return router;
};
