import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestServer } from '../helpers/serverHelper';
import { seedMinimal, makeAuthHeader } from '../helpers/seedHelper';

let server: TestServer;
let auth: string;

beforeAll(async () => {
  server = await startTestServer();
  await seedMinimal(server.db);
  auth = await makeAuthHeader(server.db);
});

afterAll(() => server.stop());

describe('GET /api/:workspace/schemas', () => {
  it('returns schemas for the default workspace', async () => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown workspace', async () => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/schemas`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(404);
  });
});
