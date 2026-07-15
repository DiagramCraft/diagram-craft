import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

test('webhook management is restricted to workspace administrators', async ({ personas }) => {
  await expect(
    personas.workspaceAdmin.orpc.webhooks.list({ params: { workspace: 'default' } })
  ).resolves.toEqual([]);
  await expect(
    personas.workspaceEditor.orpc.webhooks.list({ params: { workspace: 'default' } })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
