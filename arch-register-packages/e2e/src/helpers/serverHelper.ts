import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

export async function startTestServer(): Promise<TestServer> {
  setLogLevel('error');

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
  const app = createApp(db, storage);

  const server = createServer(toNodeHandler(app));
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const port = (server.address() as { port: number }).port;

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
