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

describe('GET /api/workspaces', () => {
  it('returns seeded workspaces', async () => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBeGreaterThan(0);
  });

  it('returns 401 without token', async () => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`);
    expect(res.status).toBe(401);
  });
});
