import { test, expect } from '../helpers/fixtures';

test.describe('GET /api/:workspace/schemas', () => {
  test('returns schemas for the default workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBeGreaterThan(0);
  });

  test('returns 404 for unknown workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/schemas`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(404);
  });
});
