import { test as baseTest } from 'vitest';
import { startTestServer, type TestServer } from './serverHelper';
import { seedMinimal, makeAuthHeader } from './seedHelper';

interface Fixtures {
  server: TestServer;
  auth: string;
}

type CreateApiTestOptions = {
  appOptions?: NonNullable<Parameters<typeof startTestServer>[0]>['appOptions'];
  afterSeed?: (server: TestServer) => Promise<void>;
};

export const createApiTest = (options: CreateApiTestOptions = {}) =>
  baseTest.extend<Fixtures>({
    server: [
      // biome-ignore lint/correctness/noEmptyPattern: ok
      async ({}, use) => {
        const server = await startTestServer({ appOptions: options.appOptions });
        await seedMinimal(server.db);
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
    ]
  });

export const test = createApiTest();

// biome-ignore lint/performance/noBarrelFile: ok
export { expect } from 'vitest';
