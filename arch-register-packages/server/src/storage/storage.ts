import type { StorageAdapter } from './storage.types';
import { FilesystemStorage } from './fs';
import { STORAGE_DEFAULTS } from '../constants';
import { resolve } from 'node:path';

export type { StorageAdapter } from './storage.types';

export const createStorage = (): StorageAdapter => {
  const backend = process.env['STORAGE_BACKEND'] ?? STORAGE_DEFAULTS.BACKEND;
  if (backend === 'fs') {
    const configuredBaseDir = process.env['STORAGE_FS_BASE'];
    const baseDir = configuredBaseDir ?? STORAGE_DEFAULTS.FS_BASE_DIR;
    const fallbackBaseDirs = configuredBaseDir
      ? []
      : [resolve(STORAGE_DEFAULTS.FS_BASE_DIR, '../../../job-server/data/projects')];
    return new FilesystemStorage(baseDir, fallbackBaseDirs);
  }
  throw new Error(`Unknown storage backend: ${backend}`);
};
