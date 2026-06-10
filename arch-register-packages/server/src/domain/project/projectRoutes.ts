import { H3, H3Event, HTTPError, defineHandler } from 'h3';
import { randomUUID } from 'node:crypto';
import type { ProjectFileDbResult } from './db/projectDatabase';
import type { StorageAdapter } from '../../storage/storage';
import type { ProjectDbCreate, ProjectDbUpdate } from '../../db/database';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { handleDbError } from '../../utils/http';
import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { toApiProjectFile } from './projectHelpers';
import { generateSvgPreview } from '../diagram/svgPreviewGenerator';
import { generateAccurateSvgPreview } from '../diagram/serverDiagramRenderer';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { getDiagramCommentCounts } from '../diagram/commentCounts';
import type { DatabaseAdapter } from '../../db/database';
import { FileTree } from '@arch-register/api-types/projectContract';

const BASE = '/api/:workspace/projects';

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

const PROJECT_STATUSES = ['pinned', 'active', 'archived'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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

export const buildCreateProjectInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date
): ProjectDbCreate => {
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
  existing: ProjectDbUpdate & { owner: string | null },
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
    } satisfies ProjectDbUpdate
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

export const createProjectRoutes = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const router = new H3();

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
          const previewSvg =
            (await generateAccurateSvgPreview(body as SerializedDiagramDocument)) ??
            generateSvgPreview(body as SerializedDiagramDocument);
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
            userId: authCtx.userId,
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
            userId: authCtx.userId,
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
          userId: authCtx.userId,
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

        requireProjectAction(
          authCtx,
          project.owner,
          'edit_project',
          'You do not have permission to modify this project'
        );

        const existingFile = await db.project.getProjectFileByPath(workspace, id, filePath);
        httpAssert.present(existingFile, { status: 404, message: `File '${filePath}' not found` });

        if (filePath === newPath) {
          return existingFile;
        }

        const targetExists = await db.project.getProjectFileByPath(workspace, id, newPath);
        httpAssert.true(!targetExists, {
          status: 409,
          message: `A file already exists at '${newPath}'`
        });

        const content = await storage.read(workspace, id, existingFile.id);
        const fileData = JSON.parse(content.toString('utf8'));

        const relocation = describeProjectFileRelocation(filePath, newPath);

        if (fileData && typeof fileData === 'object' && 'name' in fileData) {
          fileData.name = relocation.displayName;
        }

        const timestamp = new Date();
        const updatedContent = Buffer.from(JSON.stringify(fileData), 'utf8');
        const commentCounts = getDiagramCommentCounts(fileData as SerializedDiagramDocument);

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

        let previewSvg: string | null;
        try {
          previewSvg =
            (await generateAccurateSvgPreview(fileData as SerializedDiagramDocument)) ??
            generateSvgPreview(fileData as SerializedDiagramDocument) ??
            null;
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

        await storage.write(workspace, id, newFile.id, updatedContent);

        await db.project.deleteProjectFileByPath(workspace, id, filePath);
        await storage.delete(workspace, id, existingFile.id).catch(() => {});

        await logAudit(db, {
          userId: authCtx.userId,
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
