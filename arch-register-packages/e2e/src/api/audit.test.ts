import { test as baseTest, expect } from '../helpers/fixtures';
import { TEST_ADMIN } from '../helpers/seedHelper';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Extend with a file-scoped fixture that seeds audit log entries once per file
const test = baseTest.extend<{ seeded: void }>({
  seeded: [
    async ({ server }, use) => {
      await server.db.audit.createAuditLog({
        workspace: 'default',
        timestamp: daysAgo(10),
        user_id: TEST_ADMIN.id,
        operation: 'create',
        entity_type: 'entity',
        entity_id: 'e2e-e-1',
        entity_name: 'Entity One',
        entity_slug: 'entity-one',
        schema_id: null,
        changes: {},
        metadata: {}
      });
      await server.db.audit.createAuditLog({
        workspace: 'default',
        timestamp: daysAgo(20),
        user_id: TEST_ADMIN.id,
        operation: 'update',
        entity_type: 'entity',
        entity_id: 'e2e-e-2',
        entity_name: 'Entity Two',
        entity_slug: 'entity-two',
        schema_id: null,
        changes: {},
        metadata: {}
      });
      await server.db.audit.createAuditLog({
        workspace: 'default',
        timestamp: daysAgo(40),
        user_id: TEST_ADMIN.id,
        operation: 'delete',
        entity_type: 'project',
        entity_id: 'e2e-p-1',
        entity_name: 'Project One',
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {}
      });
      await use();
    },
    { scope: 'file' }
  ]
});

test.describe('GET /api/:workspace/audit', () => {
  test('returns 200 with audit log array', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
  });

  test('filters by entityType', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?entityType=entity`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ entity_type: string }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.every(r => r.entity_type === 'entity')).toBe(true);
  });

  test('filters by entityId', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?entityId=e2e-e-1`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ entity_id: string }>;
    expect(body.length).toBe(1);
    expect(body[0].entity_id).toBe('e2e-e-1');
  });

  test('filters by operation', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?operation=delete`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ operation: string }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.every(r => r.operation === 'delete')).toBe(true);
  });

  test('filters by startDate', async ({ server, auth, seeded: _ }) => {
    // 15 days ago — includes the 10-day-old entry, excludes the 20- and 40-day-old entries
    const startDate = daysAgo(15).toISOString();
    const res = await fetch(`${server.baseUrl}/api/default/audit?startDate=${encodeURIComponent(startDate)}`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ entity_id: string }>;
    const ids = body.map(r => r.entity_id);
    expect(ids).toContain('e2e-e-1');
    expect(ids).not.toContain('e2e-e-2');
    expect(ids).not.toContain('e2e-p-1');
  });

  test('filters by endDate', async ({ server, auth, seeded: _ }) => {
    // 25 days ago — includes the 40-day-old entry, excludes the 10-day-old entry
    const endDate = daysAgo(25).toISOString();
    const res = await fetch(`${server.baseUrl}/api/default/audit?endDate=${encodeURIComponent(endDate)}`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ entity_id: string }>;
    const ids = body.map(r => r.entity_id);
    expect(ids).toContain('e2e-p-1');
    expect(ids).not.toContain('e2e-e-1');
  });

  test('filters by startDate and endDate range around the 20-day-old entry', async ({ server, auth, seeded: _ }) => {
    const startDate = daysAgo(25).toISOString();
    const endDate = daysAgo(15).toISOString();
    const res = await fetch(
      `${server.baseUrl}/api/default/audit?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      { headers: { Authorization: auth } }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ entity_id: string }>;
    expect(body.length).toBe(1);
    expect(body[0].entity_id).toBe('e2e-e-2');
  });

  test('limit=1 returns one entry', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?limit=1`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBe(1);
  });

  test('limit=1&offset=1 returns the second entry', async ({ server, auth, seeded: _ }) => {
    const allRes = await fetch(`${server.baseUrl}/api/default/audit`, {
      headers: { Authorization: auth }
    });
    const all = (await allRes.json()) as Array<{ id: string }>;

    const res = await fetch(`${server.baseUrl}/api/default/audit?limit=1&offset=1`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(all[1].id);
  });

  test('invalid limit returns 400', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?limit=abc`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(400);
  });

  test('negative offset returns 400', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit?offset=-1`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(400);
  });

  test('returns 401 without auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/audit`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(404);
  });
});

test.describe('GET /api/:workspace/audit/stats', () => {
  test('returns 200 with correct shape', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit/stats`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('byOperation');
    expect(body).toHaveProperty('byEntityType');
    expect(body).toHaveProperty('recentActivity');
  });

  test('total reflects seeded entries', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit/stats`, {
      headers: { Authorization: auth }
    });
    const body = (await res.json()) as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  test('byOperation is sorted descending by count', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit/stats`, {
      headers: { Authorization: auth }
    });
    const body = (await res.json()) as { byOperation: Array<{ count: number }> };
    const counts = body.byOperation.map(r => r.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  test('recentActivity excludes the 40-day-old entry', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit/stats`, {
      headers: { Authorization: auth }
    });
    const body = (await res.json()) as { recentActivity: Array<{ date: string }> };
    const cutoffDate = daysAgo(40).toISOString().slice(0, 10);
    expect(body.recentActivity.map(r => r.date)).not.toContain(cutoffDate);
  });

  test('returns 401 without auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/audit/stats`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/audit/stats`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(404);
  });
});
