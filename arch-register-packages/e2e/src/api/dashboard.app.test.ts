import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();

const APP_KEY = 'api-integration-catalog';

test.describe('App Dashboard API', () => {
  let appDashboardId: string;

  test('getApp seeds the default layout on first access', async ({ orpc }) => {
    const dashboard = await orpc.dashboard.getApp({
      params: { workspace: 'default', appKey: APP_KEY }
    });

    expect(dashboard.appKey).toBe(APP_KEY);
    expect(dashboard.name).toBe('Overview');
    expect(dashboard.description).not.toBe('');
    expect(dashboard.widgets.map(w => w.type)).toEqual([
      'api-integration-catalog-needs-attention-count',
      'AggregateStat',
      'AggregateStat',
      'api-integration-catalog-pair-gaps',
      'api-integration-catalog-needs-attention',
      'api-integration-catalog-most-consumed',
      'api-integration-catalog-at-risk'
    ]);
    appDashboardId = dashboard.id;
  });

  test('getApp is idempotent and does not overwrite user edits', async ({ orpc }) => {
    await orpc.dashboard.update({
      params: { workspace: 'default', id: appDashboardId },
      body: { widgets: [], name: 'Catalog home', description: 'Custom description' }
    });

    const dashboard = await orpc.dashboard.getApp({
      params: { workspace: 'default', appKey: APP_KEY }
    });
    expect(dashboard.id).toBe(appDashboardId);
    expect(dashboard.widgets).toEqual([]);
    expect(dashboard.name).toBe('Catalog home');
    expect(dashboard.description).toBe('Custom description');
  });

  test('app dashboards are excluded from the home dashboard list', async ({ orpc }) => {
    const dashboards = await orpc.dashboard.list({ params: { workspace: 'default' } });
    expect(dashboards.map(d => d.id)).not.toContain(appDashboardId);
  });

  test('getApp rejects unknown app keys', async ({ orpc }) => {
    await expect(
      orpc.dashboard.getApp({ params: { workspace: 'default', appKey: 'nope' } })
    ).rejects.toBeTruthy();
  });
});
