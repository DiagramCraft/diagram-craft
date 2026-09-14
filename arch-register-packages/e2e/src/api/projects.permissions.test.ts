import { randomUUID } from 'node:crypto';
import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { PERMISSIONS_DESIGN_ONLY_ID } from '../helpers/testIds';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const teamOnlyUserId = PERMISSIONS_DESIGN_ONLY_ID;
const now = new Date('2026-02-03T00:00:00.000Z');

const test = createPermissionApiTest().extend<{
  designOnlyAuth: string;
}>({
  designOnlyAuth: [
    async ({ server, resources }, use) => {
      await createFixtureUser(server.db, {
        id: teamOnlyUserId,
        user_id: 'permissions-design-only',
        email: 'design-only@e2e.test',
        display_name: 'Design Only',
        password: 'DesignOnlyPassword123!',
        is_active: true,
        created_at: now,
        updated_at: now
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

  test('filtering: entity project lookup omits inaccessible linked projects', async ({
    server,
    designOnlyAuth,
    resources
  }) => {
    const designOnlyOrpc = createTestORPCClient(server.baseUrl, designOnlyAuth);
    const projects = await designOnlyOrpc.projects.listEntityProjects({
      params: { workspace: 'default', entityId: resources.entityIds.customerPortal }
    });

    expect(projects.map(entry => entry.project.id)).toEqual([resources.projectIds.portalRedesign]);
  });

  test('filtering: entity timeline omits changes from inaccessible projects', async ({
    server,
    designOnlyAuth,
    resources
  }) => {
    await server.db.changeCase.createCase({
      id: randomUUID(),
      workspace: resources.workspaceId,
      project_id: resources.projectIds.authMigration,
      name: 'Restricted timeline change',
      description: null,
      effective_date: '2026-12-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: now,
      members: [
        {
          entity_id: resources.entityIds.customerPortal,
          base_version: 1,
          base_state: {},
          proposed_state: {},
          diff: {}
        }
      ]
    });

    const designOnlyOrpc = createTestORPCClient(server.baseUrl, designOnlyAuth);
    const timeline = await designOnlyOrpc.entities.timelineView({
      params: { workspace: 'default' },
      body: { ids: [resources.entityIds.customerPortal] }
    });

    expect(
      timeline[resources.entityIds.customerPortal]?.projectChanges.map(
        change => change.changeCase.project_id
      )
    ).toEqual([resources.projectIds.portalRedesign]);
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
      `${server.baseUrl}/api/application/v1/default/projects/${resources.projectIds.authMigration}/files`,
      {
        headers: { Authorization: designOnlyAuth }
      }
    );
    expect(forbiddenRead.status).toBe(403);
  });

  test('capability flags match list and detail permissions for workspace and team roles', async ({
    personas,
    resources
  }) => {
    const cases = [
      {
        name: 'global administrator',
        orpc: personas.globalAdmin.orpc,
        expected: () => ({ canEdit: true, canDelete: true, canManageFiles: true })
      },
      {
        name: 'workspace administrator',
        orpc: personas.workspaceAdmin.orpc,
        expected: () => ({ canEdit: true, canDelete: true, canManageFiles: true })
      },
      {
        name: 'workspace owner',
        orpc: personas.workspaceOwner.orpc,
        expected: () => ({ canEdit: true, canDelete: true, canManageFiles: true })
      },
      {
        name: 'workspace editor',
        orpc: personas.workspaceEditor.orpc,
        expected: () => ({ canEdit: true, canDelete: false, canManageFiles: true })
      },
      {
        name: 'design owner-team administrator',
        orpc: personas.designTeamAdmin.orpc,
        expected: (project: { owner: { id: string } | null }) => ({
          canEdit: true,
          canDelete: project.owner?.id === resources.teamIds.design,
          canManageFiles: true
        })
      },
      {
        name: 'design owner-team editor',
        orpc: personas.workspaceReviewer.orpc,
        expected: () => ({ canEdit: true, canDelete: false, canManageFiles: true })
      },
      {
        name: 'workspace viewer',
        orpc: personas.workspaceViewer.orpc,
        expected: () => ({ canEdit: false, canDelete: false, canManageFiles: false })
      }
    ] as const;

    for (const testCase of cases) {
      const projects = await testCase.orpc.projects.list({
        params: { workspace: 'default' }
      });

      if (testCase.name === 'workspace viewer') {
        expect(projects, testCase.name).toHaveLength(0);
      } else {
        expect(projects, testCase.name).not.toHaveLength(0);
      }
      if (testCase.name === 'design owner-team editor') {
        expect(projects.every(project => project.owner?.id === resources.teamIds.design)).toBe(true);
      }
      for (const project of projects) {
        const expected = testCase.expected(project);
        expect(project, `${testCase.name} list response`).toMatchObject(expected);

        const detail = await testCase.orpc.projects.get({
          params: { workspace: 'default', id: project.id }
        });
        expect(detail, `${testCase.name} detail response`).toMatchObject(expected);
      }
    }

    await expect(
      personas.workspaceReviewer.orpc.projects.get({
        params: { workspace: 'default', id: resources.projectIds.authMigration }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('restricted API token reports only its effective project actions', async ({
    personas,
    server
  }) => {
    const created = await personas.globalAdmin.orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'Project edit token',
        capabilities: ['proj.edit']
      }
    });
    const tokenOrpc = createTestORPCClient(server.baseUrl, `Bearer ${created.token}`);

    const projects = await tokenOrpc.projects.list({ params: { workspace: 'default' } });
    expect(projects.map(project => project.name)).toEqual(
      expect.arrayContaining(['Portal Redesign', 'Auth Migration', 'Checkout Revamp'])
    );

    for (const project of projects) {
      expect(project).toMatchObject({
        canEdit: true,
        canDelete: false,
        canManageFiles: true
      });

      const detail = await tokenOrpc.projects.get({
        params: { workspace: 'default', id: project.id }
      });
      expect(detail).toMatchObject({
        canEdit: true,
        canDelete: false,
        canManageFiles: true
      });
    }

    await personas.globalAdmin.orpc.authProtected.apiTokens.revoke({
      params: { id: created.id }
    });
  });
});
