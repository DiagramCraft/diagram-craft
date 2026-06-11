import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { TEST_ADMIN, seedIds } from '../helpers/seedHelper';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const test = baseTest.extend<{ seeded: void }>({
  seeded: [
    async ({ server }, use) => {
      await server.db.audit.createAuditLog({
        workspace: seedIds.workspace.default,
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
        workspace: seedIds.workspace.default,
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
        workspace: seedIds.workspace.default,
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
  test('returns 200 with audit log array', async ({ orpc, seeded: _ }) => {
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: {} });
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  test('filters by entityType', async ({ orpc, seeded: _ }) => {
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { entityType: 'entity' } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(r => r.entity_type === 'entity')).toBe(true);
  });

  test('filters by entityId', async ({ orpc, seeded: _ }) => {
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { entityId: 'e2e-e-1' } });
    expect(logs.length).toBe(1);
    expect(logs[0]?.entity_id).toBe('e2e-e-1');
  });

  test('filters by operation', async ({ orpc, seeded: _ }) => {
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { operation: 'delete' } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(r => r.operation === 'delete')).toBe(true);
  });

  test('filters by startDate', async ({ orpc, seeded: _ }) => {
    const startDate = daysAgo(15).toISOString();
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { startDate } });
    const ids = logs.map(r => r.entity_id);
    expect(ids).toContain('e2e-e-1');
    expect(ids).not.toContain('e2e-e-2');
    expect(ids).not.toContain('e2e-p-1');
  });

  test('filters by endDate', async ({ orpc, seeded: _ }) => {
    const endDate = daysAgo(25).toISOString();
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { endDate } });
    const ids = logs.map(r => r.entity_id);
    expect(ids).toContain('e2e-p-1');
    expect(ids).not.toContain('e2e-e-1');
  });

  test('filters by startDate and endDate range around the 20-day-old entry', async ({ orpc, seeded: _ }) => {
    const startDate = daysAgo(25).toISOString();
    const endDate = daysAgo(15).toISOString();
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { startDate, endDate } });
    expect(logs.length).toBe(1);
    expect(logs[0]?.entity_id).toBe('e2e-e-2');
  });

  test('limit=1 returns one entry', async ({ orpc, seeded: _ }) => {
    const logs = await orpc.audit.list({ params: { workspace: 'default' }, query: { limit: 1 } });
    expect(logs.length).toBe(1);
  });

  test('limit=1&offset=1 returns the second entry', async ({ orpc, seeded: _ }) => {
    const all = await orpc.audit.list({ params: { workspace: 'default' }, query: {} });
    const page = await orpc.audit.list({ params: { workspace: 'default' }, query: { limit: 1, offset: 1 } });
    expect(page.length).toBe(1);
    expect(page[0]?.id).toBe(all[1]?.id);
  });

  test('invalid limit returns 400', async ({ orpc }) => {
    await expect(
      orpc.audit.list({ params: { workspace: 'default' }, query: { limit: -1 } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('negative offset returns 400', async ({ orpc }) => {
    await expect(
      orpc.audit.list({ params: { workspace: 'default' }, query: { offset: -1 } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.audit.list({ params: { workspace: 'default' }, query: {} })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(
      orpc.audit.list({ params: { workspace: 'nonexistent' }, query: {} })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('GET /api/:workspace/audit/stats', () => {
  test('returns 200 with correct shape', async ({ orpc, seeded: _ }) => {
    const stats = await orpc.audit.stats({ params: { workspace: 'default' } });
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('byOperation');
    expect(stats).toHaveProperty('byEntityType');
    expect(stats).toHaveProperty('recentActivity');
  });

  test('total reflects seeded entries', async ({ orpc, seeded: _ }) => {
    const stats = await orpc.audit.stats({ params: { workspace: 'default' } });
    expect(stats.total).toBeGreaterThanOrEqual(3);
  });

  test('byOperation is sorted descending by count', async ({ orpc, seeded: _ }) => {
    const stats = await orpc.audit.stats({ params: { workspace: 'default' } });
    const counts = stats.byOperation.map(r => r.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  test('recentActivity excludes the 40-day-old entry', async ({ orpc, seeded: _ }) => {
    const stats = await orpc.audit.stats({ params: { workspace: 'default' } });
    const cutoffDate = daysAgo(40).toISOString().slice(0, 10);
    expect(stats.recentActivity.map(r => r.date)).not.toContain(cutoffDate);
  });

  test('returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.audit.stats({ params: { workspace: 'default' } })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(
      orpc.audit.stats({ params: { workspace: 'nonexistent' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
