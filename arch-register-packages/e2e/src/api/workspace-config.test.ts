import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';
import type { WorkspaceRoleCapability } from '@arch-register/api-types/workspaceConfigContract';

const now = new Date('2026-06-06T12:00:00.000Z');

const test = baseTest.extend<{ seededUsers: { configUserId: string; removeUserId: string } }>({
  seededUsers: [
    async ({ server }, use) => {
      await server.db.auth.createUser({
        id: 'config-user',
        user_id: 'config-user',
        email: 'config-user@e2e.test',
        display_name: 'Config User',
        auth_provider: 'local',
        password_hash: null,
        oidc_issuer: null,
        oidc_subject: null,
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });

      await server.db.auth.createUser({
        id: 'config-remove-user',
        user_id: 'config-remove-user',
        email: 'config-remove-user@e2e.test',
        display_name: 'Config Remove User',
        auth_provider: 'local',
        password_hash: null,
        oidc_issuer: null,
        oidc_subject: null,
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });

      await use({
        configUserId: 'config-user',
        removeUserId: 'config-remove-user'
      });
    },
    { scope: 'file' }
  ]
});

const createCustomRole = async (
  orpc: TestORPCClient,
  body: { name: string; description?: string; capabilities: WorkspaceRoleCapability[] }
) => {
  return await orpc.config.roles.create({ params: { workspace: 'default' }, body });
};

test.describe('workspace config routes', () => {
  test('GET /api/:workspace/config/lifecycle-states returns seeded states', async ({
    orpc,
    seededUsers: _
  }) => {
    const states = await orpc.config.lifecycleStates.list({ params: { workspace: 'default' } });
    expect(states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seedIds.lifecycle.proposed, label: 'Proposed' }),
        expect.objectContaining({ id: seedIds.lifecycle.production, label: 'Production' })
      ])
    );
  });

  test('PUT /api/:workspace/config/lifecycle-states replaces states and normalizes order', async ({
    orpc,
    seededUsers: _
  }) => {
    const result = await orpc.config.lifecycleStates.replace({
      params: { workspace: 'default' },
      body: {
        states: [
          { id: 'live', label: 'Live', color: '#22aa55', sort_order: 99 },
          { id: 'sunset', label: 'Sunset', color: '#bb8800', sort_order: 0 }
        ]
      }
    });
    expect(result).toEqual([
      expect.objectContaining({ id: 'live', sort_order: 0 }),
      expect.objectContaining({ id: 'sunset', sort_order: 1 })
    ]);
  });

  test('GET /api/:workspace/config/teams returns the current team list', async ({
    orpc,
    seededUsers: _
  }) => {
    const teams = await orpc.config.teams.list({ params: { workspace: 'default' } });
    expect(teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Platform Engineering' }),
        expect.objectContaining({ name: 'Design Systems' })
      ])
    );
  });

  test('PUT /api/:workspace/config/teams replaces teams and GET reflects the update', async ({
    orpc,
    seededUsers: _
  }) => {
    const putResult = await orpc.config.teams.replace({
      params: { workspace: 'default' },
      body: {
        teams: [
          { name: 'Architecture', color: '#123456', description: 'Architecture team' },
          { name: 'Operations', color: null }
        ]
      }
    });
    expect(putResult).toEqual([
      expect.objectContaining({
        name: 'Architecture',
        sort_order: 0,
        color: '#123456',
        description: 'Architecture team'
      }),
      expect.objectContaining({
        name: 'Operations',
        sort_order: 1,
        color: null,
        description: ''
      })
    ]);

    const teams = await orpc.config.teams.list({ params: { workspace: 'default' } });
    expect(teams).toEqual([
      expect.objectContaining({ name: 'Architecture' }),
      expect.objectContaining({ name: 'Operations' })
    ]);
  });

  test('GET /api/:workspace/config/roles includes builtin roles', async ({
    orpc,
    seededUsers: _
  }) => {
    const roles = await orpc.config.roles.list({ params: { workspace: 'default' } });
    expect(roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'admin', builtin: true }),
        expect.objectContaining({ id: 'viewer', builtin: true })
      ])
    );
  });

  test('POST /api/:workspace/config/roles creates a sanitized custom role', async ({
    orpc,
    seededUsers: _
  }) => {
    const role = await createCustomRole(orpc, {
      name: '  <Architecture Lead>  ',
      description: ' javascript:manages roles ',
      capabilities: ['ws.view', 'people.teams', 'ws.view']
    });

    expect(role).toMatchObject({
      name: 'Architecture Lead',
      description: 'manages roles',
      builtin: false,
      tone: expect.any(String),
      capabilities: ['ws.view', 'people.teams']
    });
  });

  test('PUT /api/:workspace/config/roles/:roleId updates a custom role', async ({
    orpc,
    seededUsers: _
  }) => {
    const created = await createCustomRole(orpc, {
      name: 'Schema Steward',
      description: 'Initial',
      capabilities: ['ws.view']
    });

    const updated = await orpc.config.roles.update({
      params: { workspace: 'default', id: created.id },
      body: {
        name: 'Schema Steward Updated',
        description: 'Updated description',
        tone: '#334455',
        capabilities: ['ws.view', 'schema.edit']
      }
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Schema Steward Updated',
      description: 'Updated description',
      tone: '#334455',
      capabilities: ['ws.view', 'schema.edit']
    });
  });

  test('DELETE /api/:workspace/config/roles/:roleId returns 409 when the role is assigned', async ({
    orpc,
    seededUsers
  }) => {
    const created = await createCustomRole(orpc, {
      name: 'Assigned Role',
      capabilities: ['ws.view']
    });

    await orpc.config.members.updateRole({
      params: { workspace: 'default', id: seededUsers.configUserId },
      body: { roleId: created.id }
    });

    await expect(
      orpc.config.roles.remove({ params: { workspace: 'default', id: created.id } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Role is still assigned to workspace members'
    });
  });

  test('DELETE /api/:workspace/config/roles/:roleId deletes an unassigned custom role', async ({
    orpc,
    seededUsers: _
  }) => {
    const created = await createCustomRole(orpc, {
      name: 'Temporary Role',
      capabilities: ['ws.view']
    });

    const result = await orpc.config.roles.remove({ params: { workspace: 'default', id: created.id } });
    expect(result).toMatchObject({
      id: created.id,
      name: 'Temporary Role'
    });
  });

  test('PUT /api/:workspace/config/team-assignments replaces memberships and GET returns them', async ({
    orpc,
    seededUsers
  }) => {
    await orpc.config.teams.replace({
      params: { workspace: 'default' },
      body: {
        teams: [
          { id: 'team-platform', name: 'Platform Engineering' },
          { id: 'team-design', name: 'Design Systems' }
        ]
      }
    });

    const putResult = await orpc.config.teamAssignments.replace({
      params: { workspace: 'default' },
      body: {
        assignments: [
          {
            team_id: 'team-platform',
            user_id: seededUsers.configUserId,
            role: 'team_editor'
          }
        ]
      }
    });

    expect(putResult).toEqual([
      expect.objectContaining({
        team_id: 'team-platform',
        user_id: seededUsers.configUserId,
        role: 'team_editor'
      })
    ]);

    const assignments = await orpc.config.teamAssignments.list({ params: { workspace: 'default' } });
    expect(assignments).toEqual([
      expect.objectContaining({
        team_id: 'team-platform',
        user_id: seededUsers.configUserId,
        role: 'team_editor'
      })
    ]);
  });

  test('GET /api/:workspace/config/members and /users include seeded and test users', async ({
    orpc,
    seededUsers: _
  }) => {
    const [members, users] = await Promise.all([
      orpc.config.members.list({ params: { workspace: 'default' } }),
      orpc.config.users.list({ params: { workspace: 'default' } })
    ]);

    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'test-admin',
          email: 'admin@e2e.test'
        })
      ])
    );
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-admin',
          email: 'admin@e2e.test'
        }),
        expect.objectContaining({
          id: 'config-user',
          email: 'config-user@e2e.test'
        })
      ])
    );
  });

  test('PUT /api/:workspace/config/members/:userId/role assigns a workspace role and DELETE removes the member', async ({
    orpc,
    seededUsers
  }) => {
    const created = await createCustomRole(orpc, {
      name: 'Removable Member Role',
      capabilities: ['ws.view']
    });

    const assigned = await orpc.config.members.updateRole({
      params: { workspace: 'default', id: seededUsers.removeUserId },
      body: { roleId: created.id }
    });

    expect(assigned).toMatchObject({
      workspace: seedIds.workspace.default,
      user_id: seededUsers.removeUserId,
      role: created.id
    });

    const deleted = await orpc.config.members.remove({
      params: { workspace: 'default', id: seededUsers.removeUserId }
    });

    expect(deleted).toMatchObject({
      workspace: seedIds.workspace.default,
      user_id: seededUsers.removeUserId,
      role: created.id
    });
  });

  test('workspace config routes return 401 without auth and 404 for unknown workspaces', async ({
    server,
    orpc,
    seededUsers: _
  }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.config.lifecycleStates.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    await expect(
      orpc.config.teams.list({ params: { workspace: 'nonexistent' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
