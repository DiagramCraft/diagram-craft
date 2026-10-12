import { test as baseTest } from 'vitest';
import type { DatabaseAdapter } from '@arch-register/server/db/database';
import { startTestServer, type TestServer } from './serverHelper';
import { seedMinimal, makeAuthHeader } from './seedHelper';
import { createTestORPCClient, type TestORPCClient } from './orpcTestClient';
import { seedBootstrapData } from '@arch-register/server/db/bootstrapSeed';
import { createStorage } from '@arch-register/server/storage/storage';
import { inject } from 'vitest';

interface Fixtures {
  server: TestServer;
  auth: string;
  orpc: TestORPCClient;
}

type CreateApiTestOptions = {
  appOptions?: NonNullable<Parameters<typeof startTestServer>[0]>['appOptions'];
  afterSeed?: (server: TestServer) => Promise<void>;
  seed?: 'empty' | 'minimal' | 'bootstrap' | ((db: DatabaseAdapter) => Promise<void>);
};

export const createApiTest = (options: CreateApiTestOptions = {}) =>
  baseTest.extend<Fixtures>({
    server: [
      // biome-ignore lint/correctness/noEmptyPattern: ok
      async ({}, use) => {
        // With postgres, the globalSetup provides prebuilt templates (schema + migrations, and
        // additionally the minimal seed). Bootstrap and custom seeds start from the empty template
        // since bootstrap writes to per-server storage.
        const templates =
          process.env['E2E_DB_DRIVER'] === 'postgres' ? inject('pgTemplates') : undefined;
        const isMinimal = options.seed === undefined || options.seed === 'minimal';
        const server = await startTestServer({
          appOptions: options.appOptions,
          postgresTemplate: isMinimal ? templates?.minimal : templates?.empty
        });
        if (options.seed === 'empty') {
          // Intentionally leave the isolated database empty for fixture-focused tests.
        } else if (isMinimal && templates) {
          // Already seeded by the template.
        } else if (typeof options.seed === 'function') {
          await options.seed(server.db);
        } else if (options.seed === 'bootstrap') {
          await seedBootstrapData(server.db, createStorage());
        } else {
          await seedMinimal(server.db);
        }
        await options.afterSeed?.(server);
        await use(server);
        await server.stop();
      },
      { scope: 'file' }
    ],
    auth: [
      async ({ server }, use) => {
        await use(await makeAuthHeader(server.db));
      },
      { scope: 'file' }
    ],
    orpc: [
      async ({ server, auth }, use) => {
        await use(createTestORPCClient(server.baseUrl, auth));
      },
      { scope: 'file' }
    ]
  });

export const test = createApiTest();

// biome-ignore lint/performance/noBarrelFile: ok
export { expect } from 'vitest';
export { createTestORPCClient };
