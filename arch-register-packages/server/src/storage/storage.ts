import type { StorageAdapter } from './storage.types';
import { FilesystemStorage } from './fs';
import { STORAGE_DEFAULTS } from '../constants';

export type { StorageAdapter } from './storage.types';

export const createStorage = (): StorageAdapter => {
  const backend = process.env['STORAGE_BACKEND'] ?? STORAGE_DEFAULTS.BACKEND;
  if (backend === 'fs') {
    const baseDir = process.env['STORAGE_FS_BASE'] ?? STORAGE_DEFAULTS.FS_BASE_DIR;
    return new FilesystemStorage(baseDir);
  }
  throw new Error(`Unknown storage backend: ${backend}`);
};
