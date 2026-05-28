import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DatabaseAdapter } from './database.js';
import { PostgresDatabase } from './postgresDatabase.js';
import { SqliteDatabase } from './sqliteDatabase.js';

export const createDatabase = async (): Promise<DatabaseAdapter> => {
  const driver = process.env['DB_DRIVER'] ?? 'postgres';
  if (driver === 'postgres') {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    return new PostgresDatabase(connectionString);
  }
  if (driver === 'sqlite') {
    const filePath = resolve(process.env['SQLITE_PATH'] ?? './data/arch-register.sqlite');
    await mkdir(dirname(filePath), { recursive: true });
    return new SqliteDatabase(filePath);
  }
  throw new Error(`Unsupported DB_DRIVER: ${driver}`);
};

