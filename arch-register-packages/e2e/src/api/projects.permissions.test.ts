import { hashPassword } from '@arch-register/server/utils/password';
import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const teamOnlyUserId = 'permissions-design-only';
const now = new Date('2026-02-03T00:00:00.000Z');

const test = createPermissionApiTest().extend<{
  designOnlyAuth: string;
}>({
  designOnlyAuth: [
    async ({ server, resources }, use) => {
      const passwordHash = await hashPassword('DesignOnlyPassword123!');

      await server.db.auth.createUser({
        id: teamOnlyUserId,
        user_id: teamOnlyUserId,
        email: 'design-only@e2e.test',
        display_name: 'Design Only',
        auth_provider: 'local',
        password_hash: passwordHash,
        oidc_issuer: null,
        oidc_subject: null,
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });

      await server.db.workspace.replaceTeamAssignments(resources.workspaceId, [
        ...(await server.db.workspace.listTeamAssignments(resources.workspaceId)),
        {
          workspace: resources.workspaceId,
          team_id: resources.teamIds.design,
          user_id: teamOnlyUserId,
          role: 'team_admin',
          created_at: now
        }
      ]);

      const { makeAuthHeader } = await import('../helpers/seedHelper');
      await use(await makeAuthHeader(server.db, teamOnlyUserId));
    },
    { scope: 'file' }
  ]
});

test.describe('project permission routes', () => {
  test('authentication: project list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.projects.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('filtering: team-only project user only sees owned projects', async ({
    server,
    designOnlyAuth
  }) => {
    const designOnlyOrpc = createTestORPCClient(server.baseUrl, designOnlyAuth);
    const projects = await designOnlyOrpc.projects.list({ params: { workspace: 'default' } });

    expect(projects.map(project => project.name)).toEqual(['Portal Redesign']);
  });

  test('authorization: direct reads reject users without project access', async ({
    personas,
    resources
  }) => {
    await expect(
      personas.workspaceViewer.orpc.projects.get({
        params: { workspace: 'default', id: resources.projectIds.portalRedesign }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: create and edit are owner-sensitive for team-only users', async ({
    server,
    designOnlyAuth,
    resources
  }) => {
    const designOnlyOrpc = createTestORPCClient(server.baseUrl, designOnlyAuth);

    const created = await designOnlyOrpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Design Scoped Project', owner: resources.teamIds.design }
    });
    expect(created.name).toBe('Design Scoped Project');

    await expect(
      designOnlyOrpc.projects.update({
        params: { workspace: 'default', id: resources.projectIds.authMigration },
        body: { name: 'Should Fail' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const forbiddenRead = await fetch(
      `${server.baseUrl}/api/default/projects/${resources.projectIds.authMigration}/files`,
      {
        headers: { Authorization: designOnlyAuth }
      }
    );
    expect(forbiddenRead.status).toBe(403);
  });
});
