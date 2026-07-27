import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

const sampleWidgets = [{ id: 'a', type: 'lifecycle-chart' as const, x: 0, y: 0, w: 6, h: 4 }];

test.describe('workspace dashboard permission routes', () => {
  test('authentication: dashboard get returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.dashboard.get({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('authorization: viewer and reviewer can read the dashboard but cannot replace it', async ({
    personas
  }) => {
    for (const persona of [personas.workspaceViewer, personas.workspaceReviewer]) {
      const dashboard = await persona.orpc.dashboard.get({ params: { workspace: 'default' } });
      expect(dashboard.workspaceId).toBeTruthy();

      await expect(
        persona.orpc.dashboard.put({
          params: { workspace: 'default' },
          body: { widgets: sampleWidgets }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  test('authorization: editor, admin, and owner can replace the dashboard', async ({
    personas
  }) => {
    for (const persona of [
      personas.workspaceEditor,
      personas.workspaceAdmin,
      personas.workspaceOwner
    ]) {
      const updated = await persona.orpc.dashboard.put({
        params: { workspace: 'default' },
        body: { widgets: sampleWidgets }
      });
      expect(updated.widgets).toEqual(sampleWidgets);
    }
  });
});
