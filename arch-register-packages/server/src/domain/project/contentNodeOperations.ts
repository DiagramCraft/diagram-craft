import type { DatabaseAdapter } from '../../db/database';

import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';

import { requireProjectAccess, requireWorkspaceAdmin } from '../auth/authorization';
import { logAudit } from '../audit/db/auditLogging';

import { toApiProjectFile } from './projectHelpers';

import { httpAssert } from '../../utils/httpAssert';
import { buildFileTree } from './contentTreeOperations';

import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContentContract';

import { fileNameFromPath } from './contentFileHelpers';
import {
  contentNodeScopeFields,
  contentParentId,
  ENTITY_SCOPE,
  PROJECT_SCOPE,
  WORKSPACE_SCOPE,
  type ContentScopeResolver
} from './contentScope';
import {
  projectDbErrorMessages,
  requireNonProjectContentAccess,
  assertContentPathWritable
} from './projectOperationHelpers';

const listScopedContentNodes = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  workspace: string,
  identifier: string | undefined,
  event: AuthenticatedEvent,
  fallback: string
): Promise<FileTree> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: fallback,
    dbErrorMessages: projectDbErrorMessages,
    before:
      scope.kind === 'project'
        ? undefined
        : ({ authCtx }) => requireNonProjectContentAccess(authCtx, 'read'),
    operation: async ({ ws, authCtx }) => {
      const resolved = await scope.resolve(
        db,
        ws,
        identifier,
        authCtx,
        'read',
        scope.kind === 'project'
      );
      return buildFileTree(await resolved.listNodes(db, ws));
    }
  });

export const createScopedFolder = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  workspace: string,
  identifier: string | undefined,
  folderPath: string,
  event: AuthenticatedEvent,
  fallback: string
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: fallback,
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      if (scope.kind !== 'project') requireNonProjectContentAccess(authCtx, 'edit');
      const resolved = await scope.resolve(
        db,
        ws,
        identifier,
        authCtx,
        'edit',
        scope.kind === 'project'
      );
      const nodes = await resolved.listNodes(db, ws);
      assertContentPathWritable(nodes, folderPath);

      const timestamp = new Date();
      const row = await db.project.createContentNodeIfAbsent({
        workspace: ws,
        ...contentNodeScopeFields(resolved),
        parent_id: contentParentId(nodes, folderPath),
        path: folderPath,
        name: fileNameFromPath(folderPath),
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
          metadata: { ...resolved.auditMetadata, path: folderPath, is_folder: true }
        });
      }

      return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
    }
  });

export const listProjectFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return listScopedContentNodes(PROJECT_SCOPE, db, workspace, id, event, 'Failed to list files');
};

export const createFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return createScopedFolder(
    PROJECT_SCOPE,
    db,
    workspace,
    id,
    folderPath,
    event,
    'Failed to create folder'
  );
};

export const createEntityFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return createScopedFolder(
    ENTITY_SCOPE,
    db,
    workspace,
    entityId,
    folderPath,
    event,
    'Failed to create entity folder'
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
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update template status',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
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
  });
};

export const listEntityContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return listScopedContentNodes(
    ENTITY_SCOPE,
    db,
    workspace,
    entityId,
    event,
    'Failed to retrieve entity content nodes'
  );
};

export const listWorkspaceContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  return listScopedContentNodes(
    WORKSPACE_SCOPE,
    db,
    workspace,
    undefined,
    event,
    'Failed to retrieve workspace content nodes'
  );
};

export const createWorkspaceFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  return createScopedFolder(
    WORKSPACE_SCOPE,
    db,
    workspace,
    undefined,
    folderPath,
    event,
    'Failed to create workspace folder'
  );
};
