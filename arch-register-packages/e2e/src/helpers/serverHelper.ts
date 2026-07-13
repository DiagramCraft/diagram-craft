import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toNodeHandler } from 'h3/node';
import type { DatabaseAdapter } from '@arch-register/server/db/database';
import {
  provisionPostgresDatabase,
  provisionSqliteDatabase
} from '@arch-register/server/db/testSupport/provisionDatabase';
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

  const { db, teardown: teardownDb } =
    driver === 'postgres' ? await provisionPostgresDatabase() : await provisionSqliteDatabase();

  const tmpDir = await mkdtemp(join(tmpdir(), 'ar-e2e-api-'));

  process.env['JWT_SECRET'] = 'e2e-test-secret-must-be-at-least-32-chars!!';
  process.env['AUTH_MODE'] = 'local';
  process.env['STORAGE_BACKEND'] = 'fs';
  process.env['STORAGE_FS_BASE'] = join(tmpDir, 'storage');

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
      await teardownDb();
      await rm(tmpDir, { recursive: true, force: true });
    }
  };
}
