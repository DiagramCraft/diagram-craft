import { test, expect } from '../helpers/fixtures';

const seededEnumId = '00000000-0000-0000-0000-e00000000001';

test.describe('GET /api/:workspace/enums', () => {
  test('returns seeded enums for the default workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.length).toBeGreaterThan(0);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seededEnumId,
          workspace: 'default',
          name: 'API Type',
          options: expect.arrayContaining([
            { value: 'openapi', label: 'OpenAPI' }
          ]),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ])
    );
  });

  test('returns 404 for unknown workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/enums`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });

  test('returns 401 without authentication', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`);
    expect(res.status).toBe(401);
  });
});

test.describe('GET /api/:workspace/enums/:id', () => {
  test('returns a seeded enum by id', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums/${seededEnumId}`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: seededEnumId,
      workspace: 'default',
      name: 'API Type'
    });
  });

  test('returns 404 for an unknown enum id', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums/does-not-exist`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});

test.describe('POST /api/:workspace/enums', () => {
  test('creates an enum with explicit options and sort order', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Deployment Stage',
        options: [{ value: 'prod', label: 'Production' }],
        sort_order: 9
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      workspace: 'default',
      name: 'Deployment Stage',
      options: [{ value: 'prod', label: 'Production' }],
      sort_order: 9
    });
    expect(body['id']).toEqual(expect.any(String));
  });

  test('defaults options and sort order when omitted or invalid', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Environment',
        options: 'invalid',
        sort_order: 'invalid'
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: 'Environment',
      options: [],
      sort_order: 0
    });
  });

  test('returns 400 for a non-object request body', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify('not-an-object')
    });

    expect(res.status).toBe(400);
  });

  test('returns 409 for a duplicate enum name', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'API Type'
      })
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'An enum with that name already exists in this workspace'
    });
  });
});

test.describe('PUT /api/:workspace/enums/:id', () => {
  test('updates an enum when all mutable fields are provided', async ({ server, auth }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Change Type',
        options: [{ value: 'minor', label: 'Minor' }],
        sort_order: 1
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/enums/${created['id']}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Change Classification',
        options: [{ value: 'major', label: 'Major' }],
        sort_order: 4
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Change Classification',
      options: [{ value: 'major', label: 'Major' }],
      sort_order: 4
    });
  });

  test('preserves options and sort order when omitted', async ({ server, auth }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Risk Level',
        options: [{ value: 'low', label: 'Low' }],
        sort_order: 6
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/enums/${created['id']}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Risk Severity'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Risk Severity',
      options: [{ value: 'low', label: 'Low' }],
      sort_order: 6
    });
  });

  test('returns 404 for an unknown enum id', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums/does-not-exist`, {
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
});

test.describe('DELETE /api/:workspace/enums/:id', () => {
  test('deletes an unreferenced enum', async ({ server, auth }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/enums`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Temporary Enum'
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/enums/${created['id']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: `Enum '${created['id']}' deleted`
    });
  });

  test('returns 409 for a referenced enum', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums/${seededEnumId}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Cannot delete enum: it is still referenced by one or more schema fields'
    });
  });

  test('returns 404 for an unknown enum id', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/enums/does-not-exist`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});
