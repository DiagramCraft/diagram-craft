import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

const sampleWidgets = [{ id: 'a', type: 'lifecycle-chart' as const, x: 0, y: 0, w: 6, h: 4 }];

test.describe('workspace dashboard permission routes', () => {
  test('authentication: dashboard list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.dashboard.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('authorization: viewer and reviewer can read dashboards but cannot create or update them', async ({
    personas
  }) => {
    for (const persona of [personas.workspaceViewer, personas.workspaceReviewer]) {
      const dashboards = await persona.orpc.dashboard.list({ params: { workspace: 'default' } });
      expect(dashboards.length).toBeGreaterThan(0);
      const [dashboard] = dashboards;

      await expect(
        persona.orpc.dashboard.create({
          params: { workspace: 'default' },
          body: { name: `Blocked dashboard ${persona.userId}` }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        persona.orpc.dashboard.update({
          params: { workspace: 'default', id: dashboard!.id },
          body: { widgets: sampleWidgets }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        persona.orpc.dashboard.remove({
          params: { workspace: 'default', id: dashboard!.id }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  test('authorization: editor, admin, and owner can create, update, and delete dashboards', async ({
    personas
  }) => {
    for (const persona of [
      personas.workspaceEditor,
      personas.workspaceAdmin,
      personas.workspaceOwner
    ]) {
      const created = await persona.orpc.dashboard.create({
        params: { workspace: 'default' },
        body: { name: `Dashboard for ${persona.userId}` }
      });

      const updated = await persona.orpc.dashboard.update({
        params: { workspace: 'default', id: created.id },
        body: { widgets: sampleWidgets }
      });
      expect(updated.widgets).toEqual(sampleWidgets);

      const removed = await persona.orpc.dashboard.remove({
        params: { workspace: 'default', id: created.id }
      });
      expect(removed.success).toBe(true);
    }
  });
});
