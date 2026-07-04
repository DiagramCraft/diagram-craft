import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx } from '../auth/authorization';
import { logAudit } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { collectHiddenAttachmentNodeIds } from './contentNodeRoleUtils';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import type { ContentScopeResolver } from './contentScope';
import { FileTree } from '@arch-register/api-types/projectContract';

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

    const result = await resolved.deleteNodeFolder(db, ws, folderPath);

    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${folderPath}'`
    });

    await Promise.all(
      result.map(file => storage.delete(ws, resolved.storageId, file.id).catch(() => {}))
    );

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'delete',
      entityType: 'content_node',
      entityId: resolved.storageId,
      entityName: folderPath,
      changes: { old: { path: folderPath, type: 'folder' } },
      metadata: { ...resolved.auditMetadata, path: folderPath, is_folder: true }
    });

    return { success: true, count: result.length };
  } catch (e) {
    const fallback =
      scope.kind === 'project' ? 'Failed to delete folder' : `Failed to delete ${scope.kind} folder`;
    return handleError(e, fallback);
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

    const result = await resolved.renameNodeFolder(db, ws, oldPath, newPath, new Date());
    httpAssert.true(result.length > 0, {
      status: 404,
      message: `No files found under folder '${oldPath}'`
    });

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: 'update',
      entityType: 'content_node',
      entityId: resolved.storageId,
      entityName: newPath,
      changes: { old: { path: oldPath }, new: { path: newPath } },
      metadata: { ...resolved.auditMetadata, operation: 'rename_folder' }
    });

    return { success: true, message: `Renamed ${result.length} file(s)`, count: result.length };
  } catch (e) {
    const fallback =
      scope.kind === 'project' ? 'Failed to rename folder' : `Failed to rename ${scope.kind} folder`;
    return handleError(e, fallback);
  }
};
