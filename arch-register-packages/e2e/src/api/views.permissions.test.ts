import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

const viewData = {
  name: 'E2E Test View',
  description: 'A view created by permission tests',
  viewMode: 'table' as const,
  filters: {
    root: {
      kind: 'predicate' as const,
      path: [],
      fieldId: '_lifecycle',
      op: 'equals' as const,
      value: seedIds.lifecycle.production
    }
  },
  config: null
};

test.describe('saved view permission routes', () => {
  test('authentication: views list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.views.list({ params: { workspace: 'default' } })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
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

  test('authorization: project editor can manage project-scoped views for accessible projects', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Design Team View Project',
        owner: resources.teamIds.design
      }
    });

    const created = await personas.designTeamAdmin.orpc.views.create({
      params: { workspace: 'default' },
      body: {
        ...viewData,
        scope: 'project',
        projectId: project.id,
        projectScope: 'project'
      }
    });

    expect(created.scope).toBe('project');

    const listed = await personas.designTeamAdmin.orpc.views.list({
      params: { workspace: 'default' },
      query: {
        projectId: project.id,
        includeWorkspace: true
      }
    });
    expect(listed.some(view => view.id === created.id)).toBe(true);

    const updated = await personas.designTeamAdmin.orpc.views.update({
      params: { workspace: 'default', id: created.id },
      body: { name: 'Project Scoped View Updated', projectScope: 'all' }
    });
    expect(updated.name).toBe('Project Scoped View Updated');
    expect(updated.projectScope).toBe('all');

    await expect(
      personas.designTeamAdmin.orpc.views.remove({
        params: { workspace: 'default', id: created.id }
      })
    ).resolves.toMatchObject({ success: true });
  });

  test('authorization: users without project access cannot list project-scoped views', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Hidden View Project',
        owner: resources.teamIds.design
      }
    });

    await expect(
      personas.workspaceViewer.orpc.views.list({
        params: { workspace: 'default' },
        query: {
          projectId: project.id,
          includeWorkspace: true
        }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: outsider cannot access views at all', async ({ personas }) => {
    await expect(
      personas.outsider.orpc.views.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
