import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();

test.describe('Workspace Dashboard API', () => {
  let homeDashboardId: string;

  test('list seeds a home dashboard for a fresh workspace', async ({ orpc }) => {
    const dashboards = await orpc.dashboard.list({ params: { workspace: 'default' } });
    expect(dashboards).toHaveLength(1);

    const [dashboard] = dashboards;
    expect(dashboard!.workspaceId).toBeTruthy();
    expect(dashboard!.name).toBe('Overview');
    expect(dashboard!.order).toBe(0);
    expect(dashboard!.widgets).toEqual([]);
    expect(dashboard!.updatedAt).not.toBeNull();

    homeDashboardId = dashboard!.id;
  });

  test('update persists a widget layout and get reflects it', async ({ orpc }) => {
    const widgets = [
      {
        id: 'entities',
        type: 'stat-metric' as const,
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        config: { metricType: 'entity-count' as const }
      },
      {
        id: 'activity',
        type: 'activity-feed' as const,
        x: 0,
        y: 2,
        w: 12,
        h: 6,
        config: { limit: 10 }
      }
    ];

    const updated = await orpc.dashboard.update({
      params: { workspace: 'default', id: homeDashboardId },
      body: { widgets }
    });
    expect(updated.widgets).toEqual(widgets);
    expect(updated.updatedAt).not.toBeNull();

    const fetched = await orpc.dashboard.get({
      params: { workspace: 'default', id: homeDashboardId }
    });
    expect(fetched.widgets).toEqual(widgets);
  });

  test('update replaces the layout wholesale, not merges', async ({ orpc }) => {
    await orpc.dashboard.update({
      params: { workspace: 'default', id: homeDashboardId },
      body: {
        widgets: [
          { id: 'a', type: 'lifecycle-chart' as const, config: {}, x: 0, y: 0, w: 6, h: 4 },
          {
            id: 'b',
            type: 'stale-entity-report' as const,
            config: {},
            x: 6,
            y: 0,
            w: 6,
            h: 4
          }
        ]
      }
    });

    const replaced = await orpc.dashboard.update({
      params: { workspace: 'default', id: homeDashboardId },
      body: {
        widgets: [
          { id: 'c', type: 'lifecycle-chart' as const, config: {}, x: 0, y: 0, w: 12, h: 4 }
        ]
      }
    });

    expect(replaced.widgets).toHaveLength(1);
    expect(replaced.widgets[0]!.id).toBe('c');
  });

  test('accepts an extensible widget type and arbitrary config', async ({ orpc }) => {
    const widgets = [
      {
        id: 'custom',
        type: 'custom-widget',
        x: 0,
        y: 0,
        w: 4,
        h: 3,
        config: { nested: { enabled: true }, values: [1, 'two', null] }
      }
    ];

    const updated = await orpc.dashboard.update({
      params: { workspace: 'default', id: homeDashboardId },
      body: { widgets }
    });

    expect(updated.widgets).toEqual(widgets);
  });

  test('round-trips config for each widget type', async ({ orpc }) => {
    const widgets = [
      {
        id: 'metric',
        type: 'stat-metric' as const,
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        config: {
          metricType: 'completeness-percent' as const,
          schema: 'schema-a',
          owner: 'owner-a',
          lifecycle: 'production',
          label: 'Custom label'
        }
      },
      {
        id: 'view',
        type: 'saved-view-embed' as const,
        x: 3,
        y: 0,
        w: 3,
        h: 2,
        config: { viewId: 'view-1' }
      },
      {
        id: 'table',
        type: 'entity-table' as const,
        x: 6,
        y: 0,
        w: 6,
        h: 4,
        config: { schema: 'schema-a', limit: 5 }
      },
      {
        id: 'lifecycle',
        type: 'lifecycle-chart' as const,
        config: {},
        x: 0,
        y: 4,
        w: 6,
        h: 4
      },
      {
        id: 'trend',
        type: 'activity-trend-chart' as const,
        x: 6,
        y: 4,
        w: 6,
        h: 4,
        config: { lookbackDays: 60 }
      },
      {
        id: 'stale',
        type: 'stale-entity-report' as const,
        x: 0,
        y: 8,
        w: 6,
        h: 4,
        config: { staleAfterDays: 45 }
      },
      {
        id: 'feed',
        type: 'activity-feed' as const,
        x: 6,
        y: 8,
        w: 6,
        h: 4,
        config: { limit: 20 }
      }
    ];

    const updated = await orpc.dashboard.update({
      params: { workspace: 'default', id: homeDashboardId },
      body: { widgets }
    });
    expect(updated.widgets).toEqual(widgets);
  });

  test('create appends a new dashboard after existing ones', async ({ orpc }) => {
    const created = await orpc.dashboard.create({
      params: { workspace: 'default' },
      body: { name: 'Second dashboard' }
    });
    expect(created.name).toBe('Second dashboard');
    expect(created.order).toBeGreaterThan(0);
    expect(created.widgets).toEqual([]);

    const dashboards = await orpc.dashboard.list({ params: { workspace: 'default' } });
    expect(dashboards.map(d => d.id)).toEqual([homeDashboardId, created.id]);

    await orpc.dashboard.remove({ params: { workspace: 'default', id: created.id } });
  });

  test('remove rejects deleting the only remaining dashboard', async ({ orpc }) => {
    const dashboards = await orpc.dashboard.list({ params: { workspace: 'default' } });
    expect(dashboards).toHaveLength(1);

    await expect(
      orpc.dashboard.remove({ params: { workspace: 'default', id: homeDashboardId } })
    ).rejects.toBeTruthy();
  });

  test('remove deletes a dashboard, leaving the remaining ones in order', async ({ orpc }) => {
    const created = await orpc.dashboard.create({
      params: { workspace: 'default' },
      body: { name: 'Third dashboard' }
    });

    await orpc.dashboard.remove({ params: { workspace: 'default', id: homeDashboardId } });

    const dashboards = await orpc.dashboard.list({ params: { workspace: 'default' } });
    expect(dashboards).toHaveLength(1);
    expect(dashboards[0]!.id).toBe(created.id);

    homeDashboardId = created.id;
  });
});
