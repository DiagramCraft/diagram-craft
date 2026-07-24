import type { DatabaseAdapter } from '../../db/database';

import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';

import {
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceAdmin
} from '../auth/authorization';
import { logAudit } from '../audit/db/auditLogging';

import { toApiProjectFile } from './projectHelpers';

import { httpAssert } from '../../utils/httpAssert';
import { buildFileTree } from './contentTreeOperations';

import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';

import {
  projectDbErrorMessages,
  requireNonProjectContentAccess,
  assertContentPathWritable
} from './projectOperationHelpers';

export const listProjectFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to list files',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, id);
      httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
      requireProjectAccess(authCtx, project.owner);
      const files = await db.project.listContentNodes(ws, project.id);
      return buildFileTree(files);
    }
  );
};

export const createFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create folder',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, id);
      httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to modify this project'
      );
      assertContentPathWritable(await db.project.listContentNodes(ws, project.id), folderPath);

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
    }
  );
};

export const createEntityFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create entity folder',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireNonProjectContentAccess(authCtx, 'edit');
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      const entityUuid = entity.id;
      assertContentPathWritable(
        await db.project.listEntityContentNodes(ws, entityUuid),
        folderPath
      );

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
    }
  );
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
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update template status',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
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
    }
  );
};

export const listEntityContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve entity content nodes',
      dbErrorMessages: projectDbErrorMessages,
      before: ({ authCtx }) => requireNonProjectContentAccess(authCtx, 'read')
    },
    async ({ ws }) => {
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      const files = await db.project.listEntityContentNodes(ws, entity.id);
      return buildFileTree(files);
    }
  );
};

export const listWorkspaceContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve workspace content nodes',
      dbErrorMessages: projectDbErrorMessages,
      before: ({ authCtx }) => requireNonProjectContentAccess(authCtx, 'read')
    },
    async ({ ws }) => {
      const files = await db.project.listWorkspaceContentNodes(ws);
      return buildFileTree(files);
    }
  );
};

export const createWorkspaceFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create workspace folder',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireNonProjectContentAccess(authCtx, 'edit');
      assertContentPathWritable(await db.project.listWorkspaceContentNodes(ws), folderPath);

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
    }
  );
};
