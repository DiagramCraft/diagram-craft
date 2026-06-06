import { test as baseTest } from 'vitest';
import { startTestServer, type TestServer } from './serverHelper';
import { seedMinimal, makeAuthHeader } from './seedHelper';

interface Fixtures {
  server: TestServer;
  auth: string;
}

export const test = baseTest.extend<Fixtures>({
  server: [
    // biome-ignore lint/correctness/noEmptyPattern: ok
    async ({}, use) => {
      const server = await startTestServer();
      await seedMinimal(server.db);
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

// biome-ignore lint/performance/noBarrelFile: ok
export { expect } from 'vitest';
