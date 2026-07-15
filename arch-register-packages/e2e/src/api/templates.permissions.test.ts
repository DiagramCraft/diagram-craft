import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest().extend<{ templateSeed: true }>({
  templateSeed: [
    async ({ server, personas, resources }, use) => {
      await personas.globalAdmin.orpc.projects.saveFile({
        params: { workspace: 'default', id: resources.projectIds.portalRedesign },
        query: { path: 'templates/workspace-template.json' },
        body: { name: 'Workspace Template', diagrams: [] }
      });

      await personas.globalAdmin.orpc.projects.saveFile({
        params: { workspace: 'default', id: resources.projectIds.authMigration },
        query: { path: 'templates/project-template.json' },
        body: { name: 'Project Template', diagrams: [] }
      });

      await fetch(
        `${server.baseUrl}/api/default/projects/${resources.projectIds.portalRedesign}/template-status/${encodeURIComponent('templates/workspace-template.json')}`,
        {
          method: 'PUT',
          headers: {
            Authorization: personas.globalAdmin.auth,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_template: true, is_workspace_template: true })
        }
      );

      await fetch(
        `${server.baseUrl}/api/default/projects/${resources.projectIds.authMigration}/template-status/${encodeURIComponent('templates/project-template.json')}`,
        {
          method: 'PUT',
          headers: {
            Authorization: personas.globalAdmin.auth,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_template: true, is_workspace_template: false })
        }
      );

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('template permission routes', () => {
  test('authentication: template listing returns 401 without auth', async ({
    server,
    templateSeed: _
  }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.templates.listAll({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('filtering: users only see templates from accessible projects', async ({
    personas,
    resources,
    templateSeed: _
  }) => {
    const allTemplates = await personas.workspaceViewer.orpc.templates.listAll({
      params: { workspace: 'default' }
    });
    expect(allTemplates.workspaceTemplates).toEqual([]);
    expect(allTemplates.projectTemplates).toEqual({});

    const projectTemplates = await personas.designTeamAdmin.orpc.templates.listForProject({
      params: { workspace: 'default', id: resources.projectIds.portalRedesign }
    });
    expect(projectTemplates.workspaceTemplates.map(template => template.path)).toEqual([
      'templates/workspace-template.json'
    ]);
    expect(projectTemplates.projectTemplates).toEqual([]);
  });

  test('authorization: inaccessible project template reads return 403', async ({
    personas,
    resources,
    templateSeed: _
  }) => {
    await expect(
      personas.workspaceViewer.orpc.templates.listForProject({
        params: { workspace: 'default', id: resources.projectIds.authMigration }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: workspace template management is workspace-admin only', async ({
    server,
    personas,
    resources,
    templateSeed: _
  }) => {
    const forbiddenRes = await fetch(
      `${server.baseUrl}/api/default/projects/${resources.projectIds.portalRedesign}/template-status/${encodeURIComponent('templates/workspace-template.json')}`,
      {
        method: 'PUT',
        headers: {
          Authorization: personas.designTeamAdmin.auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_template: true, is_workspace_template: true })
      }
    );
    expect(forbiddenRes.status).toBe(403);
  });
});
