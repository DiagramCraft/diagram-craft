// Standalone server script for Playwright webServer.
// Env vars are injected by Playwright's webServer.env config.
import { createServer } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { toNodeHandler } from 'h3/node';
import { seedBootstrapData } from '@arch-register/server/db/bootstrapSeed';
import { createDatabase } from '@arch-register/server/db/factory';
import { createApp } from '@arch-register/server/app';
import { createStorage } from '@arch-register/server/storage/storage';

const PORT = Number(process.env['PORT'] ?? 3011);
const driver = process.env['DB_DRIVER'] ?? 'sqlite';

if (driver === 'sqlite') {
  const dbPath = process.env['SQLITE_PATH'] ?? '/tmp/ar-e2e-ui/test.sqlite';
  await mkdir(dirname(dbPath), { recursive: true });
  await rm(dbPath, { force: true });
}

const db = await createDatabase({ initialize: false });
await db.core.reset();
await seedBootstrapData(db);

const storage = createStorage();
const app = createApp(db, storage);

const server = createServer(toNodeHandler(app));
server.listen(PORT, () => {
  console.log(`E2E server running on http://localhost:${PORT}`);
});
