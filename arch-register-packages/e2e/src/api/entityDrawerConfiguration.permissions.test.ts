import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

test.describe('entity drawer configuration permissions', () => {
  test('allows viewers to read but only schema administrators to write', async ({ personas }) => {
    await expect(
      personas.workspaceViewer.orpc.config.entityDrawer.get({
        params: { workspace: 'default' }
      })
    ).resolves.toMatchObject({ effective_configuration: { version: 1 } });

    const body = { version: 1 as const, profiles: {} };
    await expect(
      personas.workspaceViewer.orpc.config.entityDrawer.update({
        params: { workspace: 'default' },
        body
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.workspaceAdmin.orpc.config.entityDrawer.update({
        params: { workspace: 'default' },
        body
      })
    ).resolves.toMatchObject({ effective_configuration: { version: 1 } });

    await expect(
      personas.outsider.orpc.config.entityDrawer.get({
        params: { workspace: 'default' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
