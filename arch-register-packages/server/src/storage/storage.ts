import type { StorageAdapter } from './types.js';
import { FilesystemStorage } from './fs.js';

export type { StorageAdapter } from './types.js';

export const createStorage = (): StorageAdapter => {
  const backend = process.env['STORAGE_BACKEND'] ?? 'fs';
  if (backend === 'fs') {
    const baseDir = process.env['STORAGE_FS_BASE'] ?? './data/projects';
    return new FilesystemStorage(baseDir);
  }
  throw new Error(`Unknown storage backend: ${backend}`);
};
