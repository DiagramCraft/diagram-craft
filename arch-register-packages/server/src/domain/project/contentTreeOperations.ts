import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx } from '../auth/authorization';
import { extractEntityFields, writeAudit } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { collectHiddenAttachmentNodeIds } from './contentNodeRoleUtils';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import type { ContentScopeResolver } from './contentScope';
import { FileTree } from '@arch-register/api-types/projectContract';
import { coordinateContentWrite } from './contentWriteCoordinator';
import {
  collectDescendantNodes,
  getAttachmentContainerForMarkdownNode
} from './contentNodeRoleUtils';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A project with that name already exists in this workspace',
    foreign: 'Foreign key constraint violation'
  });

export const buildFileTree = (files: ContentNodeDbResult[]): FileTree => {
  const hiddenAttachmentNodeIds = collectHiddenAttachmentNodeIds(files);
  const visibleFiles = files.filter(file => !hiddenAttachmentNodeIds.has(file.id));
  const folderNodes = visibleFiles.filter(f => f.type === 'folder');
  const nonFolderNodes = visibleFiles.filter(f => f.type !== 'folder');

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

/**
 * Deletes every content node under `folderPath` for the given scope, along with
 * their storage blobs, and records an audit log entry.
 *
 * NOTE: the pre-consolidation project-scoped `deleteFolder` did not log an audit
 * entry (unlike the entity/workspace variants) — that looked like an oversight
 * rather than intentional scope-specific behavior, so this consolidated version
 * always logs, matching entity/workspace behavior.
 */
export const deleteContentFolder = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');

    const nodes = await resolved.listNodes(db, ws);
    const result = nodes.filter(
      node => node.path === folderPath || node.path.startsWith(`${folderPath}/`)
    );
    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await coordinateContentWrite({
      db,
      storage,
      operation: 'delete-folder',
      scope: resolved.kind,
      nodeIds: result.map(node => node.id),
      storageChanges: result
        .filter(node => node.type !== 'folder')
        .map(node => ({
          type: 'delete' as const,
          workspace: ws,
          storageId: resolved.storageId,
          nodeId: node.id
        })),
      writeDatabase: async tx => {
        await resolved.deleteNodeFolder(tx, ws, folderPath);
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
              entityId: resolved.storageId,
              entityName: folderPath,
              changes: { old: { path: folderPath, type: 'folder' } },
              metadata: { ...resolved.auditMetadata, path: folderPath, is_folder: true }
            })
        }
      ]
    });

    return { success: true, count: result.length };
  } catch (e) {
    const fallback =
      scope.kind === 'project'
        ? 'Failed to delete folder'
        : `Failed to delete ${scope.kind} folder`;
    return handleError(e, fallback);
  }
};

export const deleteContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
    const nodes = await resolved.listNodes(db, ws);
    const file = nodes.find(node => node.path === filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    const container =
      file.type === 'markdown' ? getAttachmentContainerForMarkdownNode(nodes, file.id) : undefined;
    const attachments = container
      ? [container, ...collectDescendantNodes(nodes, container.id)]
      : [];
    const removed = [file, ...attachments];

    await coordinateContentWrite({
      db,
      storage,
      operation: 'delete',
      scope: resolved.kind,
      nodeIds: removed.map(node => node.id),
      storageChanges: removed
        .filter(node => node.type !== 'folder')
        .map(node => ({
          type: 'delete' as const,
          workspace: ws,
          storageId: resolved.storageId,
          nodeId: node.id
        })),
      writeDatabase: async tx => {
        await resolved.deleteNodeByPath(tx, ws, filePath);
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
              metadata: { ...resolved.auditMetadata, path: filePath }
            })
        }
      ]
    });
    return { success: true };
  } catch (e) {
    return handleError(e, `Failed to delete ${scope.kind} file`);
  }
};

/**
 * Renames every content node under `oldPath` to live under `newPath` for the
 * given scope, and records an audit log entry.
 *
 * NOTE: like `deleteContentFolder`, the pre-consolidation project-scoped
 * `renameFolder` did not log an audit entry (unlike the entity/workspace
 * variants) — preserved here as always-logging, matching entity/workspace.
 */
export const renameContentFolder = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  workspace: string,
  identifier: string | undefined,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');

    const timestamp = new Date();
    let result: string[] = [];
    await coordinateContentWrite({
      db,
      operation: 'rename-folder',
      scope: resolved.kind,
      nodeIds: [],
      writeDatabase: async tx => {
        result = await resolved.renameNodeFolder(tx, ws, oldPath, newPath, timestamp);
        httpAssert.true(result.length > 0, {
          status: 404,
          message: `No files found under folder '${oldPath}'`
        });
      },
      afterCommit: [
        {
          name: 'audit',
          run: () =>
            writeAudit(db, {
              userId: authCtx.userId,
              workspace: ws,
              operation: 'update',
              entityType: 'content_node',
              entityId: resolved.storageId,
              entityName: newPath,
              changes: { old: { path: oldPath }, new: { path: newPath } },
              metadata: { ...resolved.auditMetadata, operation: 'rename_folder' }
            })
        }
      ]
    });

    return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
  } catch (e) {
    const fallback =
      scope.kind === 'project'
        ? 'Failed to rename folder'
        : `Failed to rename ${scope.kind} folder`;
    return handleError(e, fallback);
  }
};
