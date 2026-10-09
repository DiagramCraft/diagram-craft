import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();
const params = { workspace: 'default' };

test.describe('workspace application permission routes', () => {
  test('authentication: list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.workspaceApplications.list({ params })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });

  test('authorization: viewer can list but not create applications', async ({ personas }) => {
    const { orpc } = personas.workspaceViewer;
    expect((await orpc.workspaceApplications.list({ params })).length).toBeGreaterThan(0);
    await expect(
      orpc.workspaceApplications.create({ params, body: { key: 'blocked', name: 'Blocked' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
