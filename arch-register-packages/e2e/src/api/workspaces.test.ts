import { test, expect } from '../helpers/fixtures';

test.describe('workspace routes', () => {
  test('GET /api/workspaces returns seeded workspaces', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'default',
          name: 'Default Workspace',
          url_slug: 'default',
          short_code: 'DW',
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ])
    );
  });

  test('GET /api/workspaces/templates returns available workspace templates', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces/templates`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String)
      })
    );
  });

  test('GET /api/workspaces returns 401 without token', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`);
    expect(res.status).toBe(401);
  });

  test('POST /api/workspaces creates a workspace with default settings', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Platform Strategy'
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: 'platform-strategy',
      name: 'Platform Strategy',
      url_slug: 'platform-strategy',
      short_code: 'PS'
    });

    const lifecycleStates = await server.db.workspaceAdmin.listLifecycleStates('platform-strategy');
    expect(lifecycleStates.map(state => state.id)).toEqual([
      'proposed',
      'experimental',
      'production',
      'deprecated'
    ]);

    const teams = await server.db.workspaceAdmin.listTeams('platform-strategy');
    expect(teams.map(team => team.id)).toEqual(['platform-team', 'ux-team', 'security-team']);
  });

  test('POST /api/workspaces applies slug and badge overrides', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Architecture Governance',
        slug: 'arch gov',
        badge: 'agx',
        color: '#112233',
        description: 'Workspace description'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 'arch-gov',
      name: 'Architecture Governance',
      url_slug: 'arch-gov',
      short_code: 'AG',
      color: '#112233',
      description: 'Workspace description'
    });
  });

  test('POST /api/workspaces returns 400 for a non-object request body', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify('not-an-object')
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/workspaces returns 409 for a duplicate workspace name', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Default Workspace'
      })
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'A workspace with that name already exists'
    });
  });

  test('PUT /api/workspaces/:id updates a workspace and preserves omitted fields', async ({
    server,
    auth
  }) => {
    await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Workspace To Rename',
        color: '#123456',
        description: 'Original description'
      })
    });

    const res = await fetch(`${server.baseUrl}/api/workspaces/workspace-to-rename`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Workspace Renamed'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 'workspace-to-rename',
      name: 'Workspace Renamed',
      url_slug: 'workspace-to-rename',
      color: '#123456',
      description: 'Original description'
    });
  });

  test('PUT /api/workspaces/:id replaces explicit mutable fields', async ({ server, auth }) => {
    await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Workspace Settings'
      })
    });

    const res = await fetch(`${server.baseUrl}/api/workspaces/workspace-settings`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Workspace Settings Updated',
        url_slug: 'ws settings updated',
        short_code: 'WU',
        color: '#abcdef',
        description: 'Updated description'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 'workspace-settings',
      name: 'Workspace Settings Updated',
      url_slug: 'ws-settings-updated',
      short_code: 'WU',
      color: '#abcdef',
      description: 'Updated description'
    });
  });

  test('PUT /api/workspaces/:id returns 404 for an unknown workspace id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces/does-not-exist`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Nope'
      })
    });

    expect(res.status).toBe(404);
  });

  test('DELETE /api/workspaces/:id deletes a workspace', async ({ server, auth }) => {
    await fetch(`${server.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Workspace To Delete'
      })
    });

    const res = await fetch(`${server.baseUrl}/api/workspaces/workspace-to-delete`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      message: "Workspace 'Workspace To Delete' deleted"
    });
  });

  test('DELETE /api/workspaces/:id returns 404 for an unknown workspace id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/workspaces/does-not-exist`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});
