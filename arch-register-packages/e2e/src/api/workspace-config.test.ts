import { test as baseTest, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

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

const headers = (auth: string) => ({
  Authorization: auth,
  'Content-Type': 'application/json'
});

const createCustomRole = async (
  baseUrl: string,
  auth: string,
  body: Record<string, unknown>
) => {
  const res = await fetch(`${baseUrl}/api/default/config/roles`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(body)
  });

  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
};

test.describe('workspace config routes', () => {
  test('GET /api/:workspace/config/lifecycle-states returns seeded states', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/config/lifecycle-states`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seedIds.lifecycle.proposed, label: 'Proposed' }),
        expect.objectContaining({ id: seedIds.lifecycle.production, label: 'Production' })
      ])
    );
  });

  test('PUT /api/:workspace/config/lifecycle-states replaces states and normalizes order', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/config/lifecycle-states`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify([
        { id: 'live', label: 'Live', color: '#22aa55', sort_order: 99 },
        { id: 'sunset', label: 'Sunset', color: '#bb8800', sort_order: 0 }
      ])
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([
      expect.objectContaining({ id: 'live', sort_order: 0 }),
      expect.objectContaining({ id: 'sunset', sort_order: 1 })
    ]);
  });

  test('GET /api/:workspace/config/teams and /owners return the current team list', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const [teamsRes, ownersRes] = await Promise.all([
      fetch(`${server.baseUrl}/api/default/config/teams`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/default/config/owners`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(teamsRes.status).toBe(200);
    expect(ownersRes.status).toBe(200);

    const teams = (await teamsRes.json()) as Array<Record<string, unknown>>;
    const owners = (await ownersRes.json()) as Array<Record<string, unknown>>;

    expect(teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Platform Engineering' }),
        expect.objectContaining({ name: 'Design Systems' })
      ])
    );
    expect(owners).toEqual(teams);
  });

  test('PUT /api/:workspace/config/owners replaces teams and /teams reflects the update', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const putRes = await fetch(`${server.baseUrl}/api/default/config/owners`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify([
        { name: 'Architecture', color: '#123456', description: 'Architecture team' },
        { name: 'Operations', color: null }
      ])
    });

    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toEqual([
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

    const teamsRes = await fetch(`${server.baseUrl}/api/default/config/teams`, {
      headers: { Authorization: auth }
    });
    expect(teamsRes.status).toBe(200);
    await expect(teamsRes.json()).resolves.toEqual([
      expect.objectContaining({ name: 'Architecture' }),
      expect.objectContaining({ name: 'Operations' })
    ]);
  });

  test('GET /api/:workspace/config/roles includes builtin roles', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/config/roles`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'admin', builtin: true }),
        expect.objectContaining({ id: 'viewer', builtin: true })
      ])
    );
  });

  test('POST /api/:workspace/config/roles creates a sanitized custom role', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const body = await createCustomRole(server.baseUrl, auth, {
      name: '  <Architecture Lead>  ',
      description: ' javascript:manages roles ',
      capabilities: ['ws.view', 'people.teams', 'ws.view']
    });

    expect(body).toMatchObject({
      name: 'Architecture Lead',
      description: 'manages roles',
      builtin: false,
      tone: expect.any(String),
      capabilities: ['ws.view', 'people.teams']
    });
  });

  test('PUT /api/:workspace/config/roles/:roleId updates a custom role', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const created = await createCustomRole(server.baseUrl, auth, {
      name: 'Schema Steward',
      description: 'Initial',
      capabilities: ['ws.view']
    });

    const res = await fetch(`${server.baseUrl}/api/default/config/roles/${created['id']}`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify({
        name: 'Schema Steward Updated',
        description: 'Updated description',
        tone: '#334455',
        capabilities: ['ws.view', 'schema.edit']
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Schema Steward Updated',
      description: 'Updated description',
      tone: '#334455',
      capabilities: ['ws.view', 'schema.edit']
    });
  });

  test('DELETE /api/:workspace/config/roles/:roleId returns 409 when the role is assigned', async ({
    server,
    auth,
    seededUsers
  }) => {
    const created = await createCustomRole(server.baseUrl, auth, {
      name: 'Assigned Role',
      capabilities: ['ws.view']
    });

    const assignRes = await fetch(
      `${server.baseUrl}/api/default/config/members/${seededUsers.configUserId}/role`,
      {
        method: 'PUT',
        headers: headers(auth),
        body: JSON.stringify({ role: created['id'] })
      }
    );
    expect(assignRes.status).toBe(200);

    const res = await fetch(`${server.baseUrl}/api/default/config/roles/${created['id']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Role is still assigned to workspace members'
    });
  });

  test('DELETE /api/:workspace/config/roles/:roleId deletes an unassigned custom role', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const created = await createCustomRole(server.baseUrl, auth, {
      name: 'Temporary Role',
      capabilities: ['ws.view']
    });

    const res = await fetch(`${server.baseUrl}/api/default/config/roles/${created['id']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Temporary Role'
    });
  });

  test('PUT /api/:workspace/config/team-memberships replaces memberships and GET aliases return them', async ({
    server,
    auth,
    seededUsers
  }) => {
    await fetch(`${server.baseUrl}/api/default/config/owners`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify([
        { id: 'team-platform', name: 'Platform Engineering' },
        { id: 'team-design', name: 'Design Systems' }
      ])
    });

    const putRes = await fetch(`${server.baseUrl}/api/default/config/team-memberships`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify([
        {
          team_id: 'team-platform',
          user_id: seededUsers.configUserId,
          role: 'team_editor'
        }
      ])
    });

    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toEqual([
      expect.objectContaining({
        team_id: 'team-platform',
        user_id: seededUsers.configUserId,
        role: 'team_editor'
      })
    ]);

    const [assignmentsRes, membershipsRes] = await Promise.all([
      fetch(`${server.baseUrl}/api/default/config/team-assignments`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/default/config/team-memberships`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(assignmentsRes.status).toBe(200);
    expect(membershipsRes.status).toBe(200);

    const assignments = (await assignmentsRes.json()) as Array<Record<string, unknown>>;
    const memberships = (await membershipsRes.json()) as Array<Record<string, unknown>>;
    expect(assignments).toEqual([
      expect.objectContaining({
        team_id: 'team-platform',
        user_id: seededUsers.configUserId,
        role: 'team_editor'
      })
    ]);
    expect(memberships).toEqual(assignments);
  });

  test('GET /api/:workspace/config/members and /users include seeded and test users', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const [membersRes, usersRes] = await Promise.all([
      fetch(`${server.baseUrl}/api/default/config/members`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/default/config/users`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(membersRes.status).toBe(200);
    expect(usersRes.status).toBe(200);

    const members = (await membersRes.json()) as Array<Record<string, unknown>>;
    const users = (await usersRes.json()) as Array<Record<string, unknown>>;

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
    server,
    auth,
    seededUsers
  }) => {
    const created = await createCustomRole(server.baseUrl, auth, {
      name: 'Removable Member Role',
      capabilities: ['ws.view']
    });

    const assignRes = await fetch(
      `${server.baseUrl}/api/default/config/members/${seededUsers.removeUserId}/role`,
      {
        method: 'PUT',
        headers: headers(auth),
        body: JSON.stringify({ role: created['id'] })
      }
    );

    expect(assignRes.status).toBe(200);
    await expect(assignRes.json()).resolves.toMatchObject({
      workspace: seedIds.workspace.default,
      user_id: seededUsers.removeUserId,
      role: created['id']
    });

    const deleteRes = await fetch(
      `${server.baseUrl}/api/default/config/members/${seededUsers.removeUserId}`,
      {
        method: 'DELETE',
        headers: { Authorization: auth }
      }
    );

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toMatchObject({
      workspace: seedIds.workspace.default,
      user_id: seededUsers.removeUserId,
      role: created['id']
    });
  });

  test('workspace config routes return 401 without auth and 404 for unknown workspaces', async ({
    server,
    auth,
    seededUsers: _
  }) => {
    const unauthRes = await fetch(`${server.baseUrl}/api/default/config/lifecycle-states`);
    expect(unauthRes.status).toBe(401);

    const missingWsRes = await fetch(`${server.baseUrl}/api/nonexistent/config/teams`, {
      headers: { Authorization: auth }
    });
    expect(missingWsRes.status).toBe(404);
  });
});
