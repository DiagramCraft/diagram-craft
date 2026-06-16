import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { toNodeHandler } from 'h3/node';
import type { DatabaseAdapter } from '@arch-register/server/db/database';
import { createDatabase } from '@arch-register/server/db/factory';
import { createStorage } from '@arch-register/server/storage/storage';
import { createApp } from '@arch-register/server/app';
import { setLogLevel } from '@arch-register/server/utils/logger';

export type TestServer = {
  baseUrl: string;
  db: DatabaseAdapter;
  stop: () => Promise<void>;
};

type StartTestServerOptions = {
  appOptions?: Parameters<typeof createApp>[2];
};

export async function startTestServer(options: StartTestServerOptions = {}): Promise<TestServer> {
  setLogLevel('error');

  const driver = process.env['E2E_DB_DRIVER'] ?? 'sqlite';

  if (driver === 'postgres') {
    const baseUrl = process.env['DATABASE_URL'];
    if (!baseUrl) throw new Error('DATABASE_URL is required when E2E_DB_DRIVER=postgres');

    const schema = `e2e_${randomBytes(8).toString('hex')}`;

    const adminSql = postgres(baseUrl, { max: 1 });
    await adminSql`CREATE SCHEMA ${adminSql(schema)}`;
    await adminSql.end();

    const tmpDir = await mkdtemp(join(tmpdir(), 'ar-e2e-api-'));

    process.env['DB_DRIVER'] = 'postgres';
    process.env['DATABASE_URL'] = baseUrl;
    process.env['JWT_SECRET'] = 'e2e-test-secret-must-be-at-least-32-chars!!';
    process.env['AUTH_MODE'] = 'local';
    process.env['STORAGE_BACKEND'] = 'fs';
    process.env['STORAGE_FS_BASE'] = join(tmpDir, 'storage');

    const db = await createDatabase({ initialize: false, postgresSchema: schema });
    await db.core.reset();
    const storage = createStorage();
    const app = createApp(db, storage, options.appOptions);

    const server = createServer(toNodeHandler(app));
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });

    const port = (server.address() as { port: number }).port;

    setLogLevel('fatal');

    return {
      baseUrl: `http://127.0.0.1:${port}`,
      db,
      stop: async () => {
        await new Promise<void>((resolve, reject) =>
          server.close(err => (err ? reject(err) : resolve()))
        );
        await db.core.close();
        const cleanupSql = postgres(baseUrl, { max: 1 });
        await cleanupSql`DROP SCHEMA IF EXISTS ${cleanupSql(schema)} CASCADE`;
        await cleanupSql.end();
        await rm(tmpDir, { recursive: true, force: true });
      }
    };
  }

  // SQLite path (default)
  const tmpDir = await mkdtemp(join(tmpdir(), 'ar-e2e-api-'));
  const dbPath = join(tmpDir, 'test.sqlite');

  // Must be set before createDatabase() reads them
  process.env['DB_DRIVER'] = 'sqlite';
  process.env['SQLITE_PATH'] = dbPath;
  process.env['JWT_SECRET'] = 'e2e-test-secret-must-be-at-least-32-chars!!';
  process.env['AUTH_MODE'] = 'local';
  process.env['STORAGE_BACKEND'] = 'fs';
  process.env['STORAGE_FS_BASE'] = join(tmpDir, 'storage');

  const db = await createDatabase();
  const storage = createStorage();
  const app = createApp(db, storage, options.appOptions);

  const server = createServer(toNodeHandler(app));
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const port = (server.address() as { port: number }).port;

  setLogLevel('fatal');

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    db,
    stop: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close(err => (err ? reject(err) : resolve()))
      );
      await db.core.close();
      await rm(tmpDir, { recursive: true, force: true });
    }
  };
}
