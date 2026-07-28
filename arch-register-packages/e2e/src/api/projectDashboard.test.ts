import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();

test.describe('Project Dashboard API', () => {
  test('get seeds a default dashboard for a fresh project', async ({ orpc }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Project Dashboard Seed Test' }
    });

    const dashboard = await orpc.projectDashboard.get({
      params: { workspace: 'default', projectId: project.id }
    });

    expect(dashboard.projectId).toBe(project.id);
    expect(dashboard.workspaceId).toBeTruthy();
    expect(dashboard.widgets.length).toBeGreaterThan(0);
    expect(dashboard.updatedAt).not.toBeNull();

    const fetchedAgain = await orpc.projectDashboard.get({
      params: { workspace: 'default', projectId: project.id }
    });
    expect(fetchedAgain.id).toBe(dashboard.id);
  });

  test('update persists a widget layout and get reflects it', async ({ orpc }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Project Dashboard Update Test' }
    });

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
        id: 'table',
        type: 'entity-table' as const,
        x: 0,
        y: 2,
        w: 12,
        h: 6,
        config: { limit: 10 }
      }
    ];

    const updated = await orpc.projectDashboard.update({
      params: { workspace: 'default', projectId: project.id },
      body: { widgets }
    });
    expect(updated.widgets).toEqual(widgets);

    const fetched = await orpc.projectDashboard.get({
      params: { workspace: 'default', projectId: project.id }
    });
    expect(fetched.widgets).toEqual(widgets);
  });

  test('update replaces the layout wholesale, not merges', async ({ orpc }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Project Dashboard Replace Test' }
    });

    await orpc.projectDashboard.update({
      params: { workspace: 'default', projectId: project.id },
      body: {
        widgets: [{ id: 'a', type: 'entity-table' as const, config: {}, x: 0, y: 0, w: 6, h: 4 }]
      }
    });

    const replaced = await orpc.projectDashboard.update({
      params: { workspace: 'default', projectId: project.id },
      body: {
        widgets: [
          {
            id: 'b',
            type: 'stat-metric' as const,
            x: 0,
            y: 0,
            w: 3,
            h: 2,
            config: { metricType: 'diagram-count' as const }
          }
        ]
      }
    });

    expect(replaced.widgets).toHaveLength(1);
    expect(replaced.widgets[0]!.id).toBe('b');
  });

  test('get returns 404 for a non-existent project', async ({ orpc }) => {
    await expect(
      orpc.projectDashboard.get({ params: { workspace: 'default', projectId: 'not-a-project' } })
    ).rejects.toBeTruthy();
  });
});
