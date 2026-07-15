import { randomUUID } from 'node:crypto';
import { basename, dirname } from 'node:path';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { coordinateContentWrite } from '../project/contentWriteCoordinator';
import { syncDiagramContentMetadata } from '../project/projectOperationHelpers';
import { isMarkdownPath, stripMarkdownExtension } from '../project/contentFileHelpers';
import type { ExternalContentMountDbResult } from './db/externalContentDatabase';
import {
  prepareGitRepository,
  readGitSnapshot,
  type GitSnapshot,
  type GitSnapshotFile
} from './gitSource';

const mimeTypes: Record<string, string> = {
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.txt': 'text/plain',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml'
};

const fileType = (path: string): 'diagram' | 'markdown' | 'file' =>
  isMarkdownPath(path) ? 'markdown' : path.toLowerCase().endsWith('.json') ? 'diagram' : 'file';

const isDiagramDocument = (content: Buffer) => {
  if (!content.toString('utf8').trim()) return false;
  try {
    const value = JSON.parse(content.toString('utf8')) as Record<string, unknown>;
    return (
      Array.isArray(value['diagrams']) &&
      Array.isArray(value['customPalette']) &&
      Array.isArray(value['schemas']) &&
      typeof value['styles'] === 'object' &&
      value['styles'] !== null
    );
  } catch {
    return false;
  }
};

const contentFileType = (path: string, content: Buffer): 'diagram' | 'markdown' | 'file' =>
  path.toLowerCase().endsWith('.json') && !isDiagramDocument(content) ? 'file' : fileType(path);

const nodeName = (path: string, type: 'diagram' | 'markdown' | 'file') => {
  const name = basename(path);
  if (type === 'markdown') return stripMarkdownExtension(name);
  if (type === 'diagram' && name.toLowerCase().endsWith('.json')) return name.slice(0, -5);
  return name;
};

const storageContent = (file: GitSnapshotFile, type: 'diagram' | 'markdown' | 'file') =>
  type === 'markdown'
    ? Buffer.from(JSON.stringify({ body: file.content.toString('utf8') }))
    : file.content;

const scopeForMount = (mount: ExternalContentMountDbResult) => ({
  project_id: mount.project_id,
  entity_id: mount.entity_id,
  storage_id: mount.project_id ?? mount.entity_id ?? mount.workspace
});

const buildDesiredNodes = (mount: ExternalContentMountDbResult, files: GitSnapshotFile[]) => {
  const folders = new Set<string>([mount.destination_path]);
  const desiredFiles = new Map<string, GitSnapshotFile>();
  for (const file of files) {
    const path = `${mount.destination_path}/${file.path}`;
    desiredFiles.set(path, file);
    let parent = dirname(path);
    while (parent && parent !== '.' && parent.startsWith(`${mount.destination_path}/`)) {
      folders.add(parent);
      parent = dirname(parent);
    }
  }
  return {
    folders: [...folders].sort((a, b) => a.split('/').length - b.split('/').length),
    desiredFiles
  };
};

const parseDiagram = (content: Buffer) => {
  try {
    const parsed = JSON.parse(content.toString('utf8')) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
};

const syncMount = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  mount: ExternalContentMountDbResult,
  snapshot: GitSnapshot
) => {
  const existing = await db.project.listContentNodesByMount(mount.workspace, mount.id);
  const allNodes = mount.project_id
    ? await db.project.listContentNodes(mount.workspace, mount.project_id)
    : mount.entity_id
      ? await db.project.listEntityContentNodes(mount.workspace, mount.entity_id)
      : await db.project.listWorkspaceContentNodes(mount.workspace);
  const byPath = new Map(existing.map(node => [node.path, node]));
  const allByPath = new Map(allNodes.map(node => [node.path, node]));
  const desired = buildDesiredNodes(mount, snapshot.files);
  const desiredPaths = [...desired.folders, ...desired.desiredFiles.keys()];
  const conflictingNode = desiredPaths
    .map(path => allByPath.get(path))
    .find(node => node && node.mount_id !== mount.id);
  if (conflictingNode) {
    throw new Error(
      `Mounted content path '${conflictingNode.path}' is already owned by another content node`
    );
  }
  const scope = scopeForMount(mount);
  const now = new Date();
  const nodeIds = new Map<string, string>();
  for (const path of desired.folders) nodeIds.set(path, byPath.get(path)?.id ?? randomUUID());
  for (const path of desired.desiredFiles.keys())
    nodeIds.set(path, byPath.get(path)?.id ?? randomUUID());

  const upserts = [
    ...desired.folders.map(path => ({
      path,
      type: 'folder' as const,
      content: null as Buffer | null
    })),
    ...[...desired.desiredFiles.entries()].map(([path, file]) => {
      const type = contentFileType(file.path, file.content);
      return { path, type, content: storageContent(file, type), file };
    })
  ];
  const stale = existing
    .filter(node => !nodeIds.has(node.path))
    .sort((a, b) => b.path.length - a.path.length);
  const storageChanges = upserts
    .filter(item => item.content)
    .map(item => ({
      type: 'write' as const,
      workspace: mount.workspace,
      storageId: scope.storage_id,
      nodeId: nodeIds.get(item.path)!,
      content: item.content!
    }));

  await coordinateContentWrite({
    db,
    storage,
    operation: 'external-content-sync',
    scope: `mount:${mount.id}`,
    nodeIds: [...nodeIds.values()],
    storageChanges,
    writeDatabase: async tx => {
      const parentIds = new Map<string, string | null>();
      for (const path of desired.folders) {
        parentIds.set(
          path,
          path === mount.destination_path
            ? (allByPath.get(dirname(path))?.id ?? null)
            : (nodeIds.get(dirname(path)) ?? allByPath.get(dirname(path))?.id ?? null)
        );
      }
      for (const item of upserts) {
        const existingNode = byPath.get(item.path);
        const type = item.type;
        await tx.project.upsertContentNode({
          id: nodeIds.get(item.path),
          workspace: mount.workspace,
          project_id: scope.project_id,
          entity_id: scope.entity_id,
          parent_id:
            type === 'folder'
              ? (parentIds.get(item.path) ?? null)
              : (nodeIds.get(dirname(item.path)) ?? null),
          path: item.path,
          name: type === 'folder' ? basename(item.path) : nodeName(item.path, type),
          type,
          size_bytes: item.content?.length ?? 0,
          comment_count: existingNode?.comment_count ?? 0,
          unresolved_comment_count: existingNode?.unresolved_comment_count ?? 0,
          updated_at: now,
          created_atIfNew: existingNode?.created_at ?? now,
          created_byIfNew: existingNode?.created_by ?? null,
          updated_by: null,
          mime_type:
            type === 'file'
              ? (mimeTypes[
                  basename(item.path).slice(basename(item.path).lastIndexOf('.')).toLowerCase()
                ] ?? 'application/octet-stream')
              : 'text/plain',
          original_filename: type === 'file' ? basename(item.path) : null,
          mount_id: mount.id
        });
        if (type === 'diagram' && item.content) {
          const diagram = parseDiagram(item.content);
          if (diagram)
            await syncDiagramContentMetadata(
              tx,
              mount.workspace,
              nodeIds.get(item.path)!,
              diagram as never,
              now
            );
        }
      }
      for (const node of stale) {
        await tx.project.deleteContentNodesByIds(mount.workspace, [node.id]);
        await tx.project.deleteContentMetadata(mount.workspace, node.id);
      }
      await tx.externalContent.updateMount(mount.id, {
        status: 'succeeded',
        last_synced_at: now,
        last_revision: snapshot.revision,
        last_error: null,
        updated_at: now
      });
    }
  });
  for (const node of stale) {
    if (node.type !== 'folder')
      await storage.delete(mount.workspace, scope.storage_id, node.id).catch(() => undefined);
  }
  return { files: desired.desiredFiles.size, folders: desired.folders.length };
};

export const syncExternalContentSource = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  sourceId: string
) => {
  const source = await db.externalContent.getSource(workspace, sourceId);
  if (!source?.enabled) return { skipped: true };
  const now = new Date();
  await db.externalContent.updateSource(source.id, {
    status: 'syncing',
    last_attempt_at: now,
    last_error: null,
    updated_at: now
  });
  const mounts = await db.externalContent.listMountsBySource(workspace, source.id);
  try {
    const repoPath = await prepareGitRepository(source.id, source.source_config);
    const results = [];
    let revision: string | null = null;
    for (const mount of mounts) {
      try {
        const mountSnapshot = await readGitSnapshot(repoPath, mount.source_path);
        revision ??= mountSnapshot.revision;
        results.push(await syncMount(db, storage, mount, mountSnapshot));
      } catch (error) {
        await db.externalContent.updateMount(mount.id, {
          status: 'failed',
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date()
        });
      }
    }
    const allMountsFailed = mounts.length > 0 && results.length === 0;
    await db.externalContent.updateSource(source.id, {
      status: allMountsFailed ? 'failed' : 'succeeded',
      last_synced_at: allMountsFailed ? source.last_synced_at : now,
      last_revision: revision ?? source.last_revision,
      last_error: allMountsFailed ? 'All content mounts failed to synchronize' : null,
      updated_at: new Date()
    });
    return { revision, mounts: mounts.length, results };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.externalContent.updateSource(source.id, {
      status: 'failed',
      last_error: message,
      updated_at: new Date()
    });
    throw error;
  }
};
