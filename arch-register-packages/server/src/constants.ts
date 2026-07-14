import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPackageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Server configuration constants
 */
export const SERVER_DEFAULTS = {
  PORT: 3010,
  MAX_DB_CONNECTIONS: 10,
  DB_IDLE_TIMEOUT: 30,
  DB_CONNECT_TIMEOUT: 10,
} as const;

/**
 * Database error codes
 */
export const DB_ERROR_CODES = {
  UNIQUE: '23505',
  FOREIGN_KEY: '23503',
  CHECK: '23514',
  NOT_NULL: '23502',
} as const;

/**
 * SQLite error code patterns
 */
export const SQLITE_ERROR_PATTERNS = {
  UNIQUE: 'UNIQUE',
  PRIMARY_KEY: 'PRIMARYKEY',
  FOREIGN_KEY: 'FOREIGNKEY',
  CHECK: 'CHECK',
  NOT_NULL: 'NOTNULL',
} as const;

/**
 * Search and pagination defaults
 */
export const SEARCH_DEFAULTS = {
  LIMIT_PER_TYPE: 10,
  REQUEST_TIMEOUT_MS: 5000,
} as const;

/**
 * Entity catalog pagination defaults
 */
export const ENTITY_DEFAULTS = {
  PAGE_SIZE: 200
} as const;

/**
 * Storage configuration
 */
export const STORAGE_DEFAULTS = {
  BACKEND: 'fs',
  FS_BASE_DIR: resolve(serverPackageDir, 'data/projects'),
} as const;

/**
 * Database configuration
 */
export const DB_DEFAULTS = {
  DRIVER: 'postgres',
  SQLITE_PATH: './data/arch-register.sqlite',
} as const;
