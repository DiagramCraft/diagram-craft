import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DatabaseAdapter } from './database';
import { PostgresDatabase } from './postgresDatabase';
import { SqliteDatabase } from './sqliteDatabase';
import { DB_DEFAULTS } from '../constants';
import { assert } from '@diagram-craft/utils/assert';

type CreateDatabaseOptions = {
  initialize?: boolean;
};

export const createDatabase = async (
  options: CreateDatabaseOptions = {}
): Promise<DatabaseAdapter> => {
  const driver = process.env['DB_DRIVER'] ?? DB_DEFAULTS.DRIVER;
  const initialize = options.initialize ?? true;
  switch (driver) {
    case 'postgres': {
      const connectionString = process.env['DATABASE_URL'];
      if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
      const db = new PostgresDatabase(connectionString);
      if (initialize) {
        await db.initialize();
      }
      return db;
    }
    case 'sqlite': {
      const filePath = resolve(process.env['SQLITE_PATH'] ?? DB_DEFAULTS.SQLITE_PATH);
      await mkdir(dirname(filePath), { recursive: true });
      return new SqliteDatabase(filePath);
    }
  }

  assert.fail(`Unsupported DB_DRIVER: ${driver}`);
};
