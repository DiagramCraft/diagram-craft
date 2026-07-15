import type { DatabaseAdapter } from '../../db/database';
import type {
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ExportDocumentData
} from './exportTypes';

export interface ImportCacheEntry {
  import_id: string;
  workspace_id: string;
  user_id: string;
  manifest: ExportManifest;
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  };
  content_files?: Record<string, string>; // Map of path -> base64 encoded content
  created_at: Date;
  expires_at: Date;
}

const CACHE_TTL_HOURS = 24; // Import cache expires after 24 hours

/**
 * Store parsed import data in the database cache
 */
export const storeImportCache = async (
  db: DatabaseAdapter,
  workspaceId: string,
  userId: string,
  manifest: ExportManifest,
  data: ImportCacheEntry['data'],
  contentFiles?: Map<string, Buffer>
): Promise<string> => {
  const importId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  // Convert content files Map to Record for JSON storage
  const contentFilesRecord: Record<string, string> | undefined = contentFiles
    ? Object.fromEntries(
        Array.from(contentFiles.entries()).map(([path, buffer]) => [
          path,
          buffer.toString('base64')
        ])
      )
    : undefined;

  const entry: ImportCacheEntry = {
    import_id: importId,
    workspace_id: workspaceId,
    user_id: userId,
    manifest,
    data,
    content_files: contentFilesRecord,
    created_at: now,
    expires_at: expiresAt
  };

  await db.workspace.storeImportCache(entry);
  return importId;
};

/**
 * Retrieve parsed import data from the database cache
 */
export const getImportCache = async (
  db: DatabaseAdapter,
  workspaceId: string,
  userId: string,
  importId: string
): Promise<{
  manifest: ExportManifest;
  data: ImportCacheEntry['data'];
  contentFiles?: Map<string, Buffer>;
} | null> => {
  const entry = await db.workspace.getImportCache(importId);

  if (!entry) {
    return null;
  }

  // Verify workspace and user match
  if (entry.workspace_id !== workspaceId || entry.user_id !== userId) {
    return null;
  }

  // Check if expired
  if (new Date() > entry.expires_at) {
    await db.workspace.deleteImportCache(importId);
    return null;
  }

  // Convert content files Record back to Map
  const contentFiles = entry.content_files
    ? new Map(
        Object.entries(entry.content_files).map(([path, base64]) => [
          path,
          Buffer.from(base64, 'base64')
        ])
      )
    : undefined;

  return {
    manifest: entry.manifest,
    data: entry.data,
    contentFiles
  };
};

/**
 * Delete import cache entry after successful import
 */
export const deleteImportCache = async (db: DatabaseAdapter, importId: string): Promise<void> => {
  await db.workspace.deleteImportCache(importId);
};

/**
 * Clean up expired import cache entries (should be run periodically)
 */
export const cleanupExpiredImportCache = async (db: DatabaseAdapter): Promise<number> => {
  return await db.workspace.cleanupExpiredImportCache();
};
