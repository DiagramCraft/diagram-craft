import type { StorageAdapter } from './storage.types.js';
import { FilesystemStorage } from './fs.js';
import { STORAGE_DEFAULTS } from '../constants.js';

export type { StorageAdapter } from './storage.types.js';

export const createStorage = (): StorageAdapter => {
  const backend = process.env['STORAGE_BACKEND'] ?? STORAGE_DEFAULTS.BACKEND;
  if (backend === 'fs') {
    const baseDir = process.env['STORAGE_FS_BASE'] ?? STORAGE_DEFAULTS.FS_BASE_DIR;
    return new FilesystemStorage(baseDir);
  }
  throw new Error(`Unknown storage backend: ${backend}`);
};
