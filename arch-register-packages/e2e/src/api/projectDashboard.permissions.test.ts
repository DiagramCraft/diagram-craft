import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

test.describe('project dashboard permission routes', () => {
  test('authentication: project dashboard get returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.projectDashboard.get({ params: { workspace: 'default', projectId: 'anything' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('authorization: project editor can read and update their project dashboard', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Design Team Dashboard Project',
        owner: resources.teamIds.design
      }
    });

    const dashboard = await personas.designTeamAdmin.orpc.projectDashboard.get({
      params: { workspace: 'default', projectId: project.id }
    });
    expect(dashboard.projectId).toBe(project.id);

    const widgets = [
      { id: 'a', type: 'EntityTable' as const, config: {}, x: 0, y: 0, w: 6, h: 4 }
    ];
    const updated = await personas.designTeamAdmin.orpc.projectDashboard.update({
      params: { workspace: 'default', projectId: project.id },
      body: { widgets }
    });
    expect(updated.widgets).toEqual(widgets);
  });

  test('authorization: users without project access cannot read or update the project dashboard', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Hidden Dashboard Project',
        owner: resources.teamIds.design
      }
    });

    await expect(
      personas.outsider.orpc.projectDashboard.get({
        params: { workspace: 'default', projectId: project.id }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.outsider.orpc.projectDashboard.update({
        params: { workspace: 'default', projectId: project.id },
        body: { widgets: [] }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
