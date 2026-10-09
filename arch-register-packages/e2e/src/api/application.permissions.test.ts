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

  test('authorization: viewer cannot create applications and only lists accessible ones', async ({
    personas
  }) => {
    const { orpc } = personas.workspaceViewer;
    // Applications without an access policy are hidden from ordinary members
    expect(await orpc.workspaceApplications.list({ params })).toEqual([]);
    expect(
      (await personas.workspaceAdmin.orpc.workspaceApplications.list({ params })).length
    ).toBeGreaterThan(0);
    await expect(
      orpc.workspaceApplications.create({ params, body: { key: 'blocked', name: 'Blocked' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
