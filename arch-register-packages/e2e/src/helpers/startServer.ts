// Standalone server script for Playwright webServer.
// Env vars are injected by Playwright's webServer.env config.
import { createServer } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import postgres from 'postgres';
import { toNodeHandler } from 'h3/node';
import { seedBootstrapData } from '@arch-register/server/db/bootstrapSeed';
import { createDatabase } from '@arch-register/server/db/factory';
import { recreatePostgresSchema } from '@arch-register/server/db/maintenance/recreateDatabase';
import { createApp } from '@arch-register/server/app';
import { createStorage } from '@arch-register/server/storage/storage';

const PORT = Number(process.env['PORT'] ?? 3011);
const driver = process.env['DB_DRIVER'] ?? 'sqlite';
const postgresSchema = process.env['POSTGRES_SCHEMA'];

if (driver === 'sqlite') {
  const dbPath = process.env['SQLITE_PATH'] ?? '/tmp/ar-e2e-ui/test.sqlite';
  await mkdir(dirname(dbPath), { recursive: true });
  await rm(dbPath, { force: true });
} else if (driver === 'postgres') {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL E2E tests');
  if (!postgresSchema) throw new Error('POSTGRES_SCHEMA is required for PostgreSQL E2E tests');
  await recreatePostgresSchema(connectionString, postgresSchema);
}

const db = await createDatabase({
  initialize: false,
  ...(postgresSchema ? { postgresSchema } : {})
});

const storage = createStorage();
await seedBootstrapData(db, storage);

const { app } = createApp(db, storage);

const server = createServer(toNodeHandler(app));
server.listen(PORT, () => {
  console.log(`E2E server running on http://localhost:${PORT}`);
});

const shutdown = async () => {
  await db.core.close();
  if (driver === 'postgres' && postgresSchema) {
    const connectionString = process.env['DATABASE_URL'];
    if (connectionString) {
      const adminSql = postgres(connectionString, { max: 1, onnotice: () => undefined });
      await adminSql`DROP SCHEMA IF EXISTS ${adminSql(postgresSchema)} CASCADE`;
      await adminSql.end();
    }
  }
  process.exit(0);
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
