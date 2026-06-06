import { test, expect } from '../helpers/fixtures';

const apiSchemaId = '00000000-0000-0000-0000-000000000004';
const apiTypeEnumId = '00000000-0000-0000-0000-e00000000001';

test.describe('schema routes', () => {
  test('GET /api/:workspace/schemas returns seeded schemas with expanded select options', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.length).toBeGreaterThan(0);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: apiSchemaId,
          workspace: 'default',
          name: 'API',
          entity_count: 0,
          created_at: expect.any(String),
          updated_at: expect.any(String),
          fields: expect.arrayContaining([
            expect.objectContaining({
              id: 'api_type',
              type: 'select',
              enumId: apiTypeEnumId,
              options: expect.arrayContaining([
                expect.objectContaining({ value: 'openapi', label: 'OpenAPI' })
              ])
            })
          ])
        })
      ])
    );
  });

  test('GET /api/:workspace/schemas returns 401 without authentication', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`);
    expect(res.status).toBe(401);
  });

  test('GET /api/:workspace/schemas returns 404 for unknown workspace', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/schemas`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });

  test('GET /api/:workspace/schemas/:id returns a seeded schema by id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas/${apiSchemaId}`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: apiSchemaId,
      workspace: 'default',
      name: 'API'
    });
  });

  test('GET /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas/does-not-exist`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });

  test('POST /api/:workspace/schemas creates a schema with normalized optional fields', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Capability',
        description: 42,
        fields: 'invalid',
        color: 1,
        icon: 'star',
        default_owner: 'Missing Team'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      workspace: 'default',
      name: 'Capability',
      description: '',
      fields: [],
      color: null,
      icon: 'star'
    });
  });

  test('POST /api/:workspace/schemas creates a schema with explicit fields and default owner', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Service',
        description: 'Deployable service',
        color: '#112233',
        icon: 'server',
        default_owner: 'Platform Engineering',
        fields: [
          { id: 'runtime', name: 'Runtime', type: 'text' },
          {
            id: 'tier',
            name: 'Tier',
            type: 'select',
            enumId: apiTypeEnumId
          }
        ]
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      workspace: 'default',
      name: 'Service',
      description: 'Deployable service',
      color: '#112233',
      icon: 'server'
    });
    expect(body['id']).toEqual(expect.any(String));
    expect(body['fields']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'runtime', type: 'text' }),
        expect.objectContaining({
          id: 'tier',
          type: 'select',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'openapi', label: 'OpenAPI' })
          ])
        })
      ])
    );
  });

  test('POST /api/:workspace/schemas returns 400 for a non-object request body', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify('not-an-object')
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/:workspace/schemas returns 409 for a duplicate schema name', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'API'
      })
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'A schema with that name already exists in this workspace'
    });
  });

  test('PUT /api/:workspace/schemas/:id updates a schema and preserves omitted fields', async ({
    server,
    auth
  }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Bounded Context',
        description: 'Original description',
        color: '#abcdef',
        icon: 'layers',
        default_owner: 'Platform Engineering',
        fields: [{ id: 'mission', name: 'Mission', type: 'text' }]
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/schemas/${created['id']}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Context Boundary'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Context Boundary',
      description: 'Original description',
      color: '#abcdef',
      icon: 'layers',
      fields: [expect.objectContaining({ id: 'mission', type: 'text' })]
    });
  });

  test('PUT /api/:workspace/schemas/:id replaces explicit mutable fields', async ({
    server,
    auth
  }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Integration',
        description: 'Original',
        color: '#aabbcc',
        icon: 'plug',
        default_owner: 'Platform Engineering',
        fields: [{ id: 'protocol', name: 'Protocol', type: 'text' }]
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/schemas/${created['id']}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Integration Surface',
        description: 7,
        color: 1,
        icon: null,
        default_owner: 'Design Systems',
        fields: [
          {
            id: 'type',
            name: 'Type',
            type: 'select',
            enumId: apiTypeEnumId
          }
        ]
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Integration Surface',
      description: '',
      color: null,
      icon: null,
      fields: [
        expect.objectContaining({
          id: 'type',
          type: 'select',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'openapi', label: 'OpenAPI' })
          ])
        })
      ]
    });
  });

  test('PUT /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas/does-not-exist`, {
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

  test('DELETE /api/:workspace/schemas/:id deletes an unreferenced schema', async ({
    server,
    auth
  }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/schemas`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Temporary Schema'
      })
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await fetch(`${server.baseUrl}/api/default/schemas/${created['id']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      message: `Schema '${created['id']}' deleted`
    });
  });

  test('DELETE /api/:workspace/schemas/:id returns 409 for a referenced seeded schema', async ({
    server,
    auth
  }) => {
    await server.db.catalog.createEntity({
      id: 'e2e-schema-ref-entity',
      workspace: 'default',
      slug: 'schema-ref-entity',
      namespace: 'default',
      name: 'Schema Ref Entity',
      description: '',
      owner: 'Platform Engineering',
      lifecycle: 'production',
      tags: [],
      links: [],
      schema_id: apiSchemaId,
      data: {},
      visibility_mode: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    const res = await fetch(`${server.baseUrl}/api/default/schemas/${apiSchemaId}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Cannot delete schema: entities still reference it'
    });
  });

  test('DELETE /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({
    server,
    auth
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/schemas/does-not-exist`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});
