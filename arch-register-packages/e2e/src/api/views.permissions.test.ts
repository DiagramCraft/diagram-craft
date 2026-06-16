import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

const viewData = {
  name: 'E2E Test View',
  description: 'A view created by permission tests',
  viewMode: 'table' as const,
  filters: {
    status: seedIds.lifecycle.production,
    q: 'test'
  },
  config: null
};

test.describe('saved view permission routes', () => {
  test('authentication: views list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.views.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('authorization: viewer can list views but cannot create, update, or delete', async ({
    personas
  }) => {
    const views = await personas.workspaceViewer.orpc.views.list({
      params: { workspace: 'default' }
    });
    expect(views.length).toBeGreaterThan(0);

    await expect(
      personas.workspaceViewer.orpc.views.create({
        params: { workspace: 'default' },
        body: viewData
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.workspaceViewer.orpc.views.update({
        params: { workspace: 'default', id: views[0]!.id },
        body: { name: 'Should not be allowed' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.workspaceViewer.orpc.views.remove({
        params: { workspace: 'default', id: views[0]!.id }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: outsider cannot access views at all', async ({ personas }) => {
    await expect(
      personas.outsider.orpc.views.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
