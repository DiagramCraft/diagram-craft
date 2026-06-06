import { test, expect } from '../helpers/fixtures';

test.describe('GET /api/workspaces', () => {
  test('returns seeded workspaces', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBeGreaterThan(0);
  });

  test('returns 401 without token', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`);
    expect(res.status).toBe(401);
  });
});
