import { seedEntities } from '@arch-register/server/db/seedData';
import { expect, test as baseTest } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';

const test = baseTest.extend<{ seeded: true }>({
  seeded: [
    async ({ server }, use) => {
      await seedCatalogEntities(server.db);
      await use(true);
    },
    { scope: 'file' }
  ]
});

const headers = (auth: string) => ({
  'Authorization': auth,
  'Content-Type': 'application/json'
});

const domainId = '00000000-0000-0000-0001-000000000001';
const systemId = '00000000-0000-0000-0002-000000000001';
const apiId = '00000000-0000-0000-0004-000000000001';
const componentId = '00000000-0000-0000-0003-000000000002';
const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const apiSchemaId = '00000000-0000-0000-0000-000000000004';

const createEntity = async (baseUrl: string, auth: string, body: Record<string, unknown>) => {
  const res = await fetch(`${baseUrl}/api/default/data`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(body)
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
};

test.describe('data routes', () => {
  test('GET /api/:workspace/data lists seeded entities and supports summary filters', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/data?view=summary&_schemaId=${componentSchemaId}&owner=${encodeURIComponent(seedIds.teams.design)}&q=react`,
      {
        headers: { Authorization: auth }
      }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual([
      expect.objectContaining({
        _uid: componentId,
        _name: 'Frontend App',
        _owner: expect.objectContaining({ id: seedIds.teams.design }),
        _schema: expect.objectContaining({ id: componentSchemaId })
      })
    ]);
    expect(body[0]).not.toHaveProperty('technology');
  });

  test('GET /api/:workspace/data returns 401 without authentication', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data`);
    expect(res.status).toBe(401);
  });

  test('GET /api/:workspace/data/facets returns counts for seeded entities', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data/facets`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      total: seedEntities.length,
      completeness: {
        below50: expect.any(Number),
        below80: expect.any(Number),
        above80: expect.any(Number)
      }
    });
  });

  test('GET /api/:workspace/data/tree returns matches with ancestor edges', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data/tree?q=frontend`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, string>>;
    };
    expect(body.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _uid: componentId, _isMatch: true }),
        expect.objectContaining({ _uid: systemId, _isMatch: false }),
        expect.objectContaining({ _uid: domainId, _isMatch: false })
      ])
    );
    expect(body.edges).toEqual(
      expect.arrayContaining([
        { childId: componentId, parentId: systemId },
        { childId: systemId, parentId: domainId }
      ])
    );
  });

  test('GET /api/:workspace/data/export returns schema-specific CSV output', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(
      `${server.baseUrl}/api/download/default/data/export?_schemaId=${apiSchemaId}`,
      {
        headers: { Authorization: auth }
      }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const body = await res.text();
    expect(body).toContain('Schema Type;Type;System');
    expect(body).toContain('Customer API');
    expect(body).toContain('openapi');
  });

  test('GET /api/:workspace/data/import/template/:schemaId returns CSV headers', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(
      `${server.baseUrl}/api/download/default/data/import/template/${componentSchemaId}`,
      {
        headers: { Authorization: auth }
      }
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"Name"');
    expect(body).toContain('"Technology"');
    expect(body).toContain('"Depends On"');
  });

  test('POST /api/:workspace/data/import/parse matches existing rows by slug', async ({
    server,
    auth,
    seeded: _
  }) => {
    const csvContent = [
      '"Name";"Slug";"Namespace";"Description";"Technology";"System"',
      '"Frontend App";"frontend-app";"default";"Updated from CSV";"React";"Customer Portal"'
    ].join('\n');

    const res = await fetch(`${server.baseUrl}/api/default/data/import/parse`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        schemaId: componentSchemaId,
        csvContent
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entities: Array<Record<string, unknown>>;
      validRows: number;
    };
    expect(body.validRows).toBe(1);
    expect(body.entities[0]).toMatchObject({
      isUpdate: true,
      matchType: 'slug',
      existingId: componentId
    });
  });

  test('POST /api/:workspace/data creates an entity and inherits owner from its parent', async ({
    server,
    auth,
    seeded: _
  }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: apiSchemaId,
      _name: 'Billing API',
      _namespace: 'default',
      _lifecycle: seedIds.lifecycle.production,
      _tags: ['rest'],
      api_type: 'openapi',
      system: systemId
    });

    expect(created).toMatchObject({
      _name: 'Billing API',
      _slug: 'billing-api',
      _owner: expect.objectContaining({ id: seedIds.teams.design }),
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      api_type: 'openapi',
      system: systemId
    });
  });

  test('GET /api/:workspace/data/:id returns entity detail', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data/${componentId}`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      _uid: componentId,
      _name: 'Frontend App',
      technology: 'React',
      depends_on: '00000000-0000-0000-0003-000000000001'
    });
  });

  test('GET /api/:workspace/data/:id/relations returns incoming and outgoing relations', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data/${componentId}/relations`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      outgoing: Array<Record<string, unknown>>;
      incoming: Array<Record<string, unknown>>;
    };
    expect(body.outgoing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: systemId,
          fieldName: 'System',
          kind: 'containment'
        }),
        expect.objectContaining({
          entityId: apiId,
          fieldName: 'Consumed APIs',
          kind: 'reference'
        })
      ])
    );
    expect(body.incoming).toEqual([]);
  });

  test('GET and PUT /api/:workspace/data/:id/access round-trip grants', async ({
    server,
    auth,
    seeded: _
  }) => {
    const getRes = await fetch(`${server.baseUrl}/api/default/data/${componentId}/access`, {
      headers: { Authorization: auth }
    });
    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toMatchObject({
      owner: seedIds.teams.design,
      visibility_mode: null,
      grants: []
    });

    const putRes = await fetch(`${server.baseUrl}/api/default/data/${componentId}/access`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify({
        grants: [
          {
            principal_type: 'team',
            principal_id: seedIds.teams.platform,
            role: 'viewer',
            applies_to: 'subtree'
          }
        ]
      })
    });

    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toMatchObject({
      owner: seedIds.teams.design,
      grants: [
        expect.objectContaining({
          principal_type: 'team',
          principal_id: seedIds.teams.platform,
          role: 'viewer',
          applies_to: 'subtree'
        })
      ]
    });
  });

  test('PUT /api/:workspace/data/:id updates an entity', async ({ server, auth, seeded: _ }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: componentSchemaId,
      _name: 'Session Worker',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      technology: 'Node.js',
      system: systemId
    });

    const res = await fetch(`${server.baseUrl}/api/default/data/${created['_uid']}`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify({
        _schemaId: componentSchemaId,
        _name: 'Session Worker v2',
        _slug: 'session-worker-v2',
        _namespace: 'default',
        _description: 'Processes session jobs',
        _owner: seedIds.teams.security,
        _lifecycle: seedIds.lifecycle.production,
        _tags: ['worker'],
        _visibilityMode: 'restricted',
        technology: 'Go',
        system: systemId
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      _uid: created['_uid'],
      _name: 'Session Worker v2',
      _slug: 'session-worker-v2',
      _owner: expect.objectContaining({ id: seedIds.teams.security }),
      _visibilityMode: 'restricted',
      technology: 'Go'
    });
  });

  test('POST /api/:workspace/data/:id/clone clones an entity', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/data/${apiId}/clone`, {
      method: 'POST',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      _name: 'Customer API (copy)',
      _slug: 'customer-api-copy',
      api_type: 'openapi',
      system: systemId
    });
  });

  test('POST /api/:workspace/data/import/commit creates and updates entities', async ({
    server,
    auth,
    seeded: _
  }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: componentSchemaId,
      _name: 'CSV Worker',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      technology: 'TypeScript',
      system: systemId
    });

    const res = await fetch(`${server.baseUrl}/api/default/data/import/commit`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        schemaId: componentSchemaId,
        entities: [
          {
            _existingId: created['_uid'],
            _name: 'CSV Worker Updated',
            _slug: 'csv-worker',
            _namespace: 'default',
            _description: 'Updated via import',
            _owner: seedIds.teams.platform,
            _lifecycle: seedIds.lifecycle.production,
            technology: 'Rust',
            system: 'Customer Portal'
          },
          {
            _name: 'Import-created Component',
            _slug: 'import-created-component',
            _namespace: 'default',
            _description: 'Created via import',
            _owner: seedIds.teams.design,
            _lifecycle: seedIds.lifecycle.production,
            technology: 'React',
            system: 'Customer Portal',
            depends_on: 'API Gateway'
          }
        ]
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      created: number;
      updated: number;
      ids: string[];
    };
    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.ids).toHaveLength(2);

    const importedEntities = await Promise.all(
      body.ids.map(async id => {
        const entityRes = await fetch(`${server.baseUrl}/api/default/data/${id}`, {
          headers: { Authorization: auth }
        });

        expect(entityRes.status).toBe(200);
        return (await entityRes.json()) as Record<string, unknown>;
      })
    );

    expect(importedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _name: 'Import-created Component',
          technology: 'React'
        }),
        expect.objectContaining({
          _uid: created['_uid'],
          _name: 'CSV Worker Updated',
          technology: 'Rust'
        })
      ])
    );
  });

  test('DELETE /api/:workspace/data/:id deletes an entity', async ({ server, auth, seeded: _ }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: apiSchemaId,
      _name: 'Delete Me API',
      api_type: 'graphql',
      system: systemId
    });

    const res = await fetch(`${server.baseUrl}/api/default/data/${created['_uid']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      message: `Data record '${created['_uid']}' deleted`
    });
  });

  test('returns 404 for unknown workspace', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/data`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });

  test('POST /api/:workspace/data creates entity with target lifecycle and date', async ({
    server,
    auth,
    seeded: _
  }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: apiSchemaId,
      _name: 'Sunset API',
      _lifecycle: seedIds.lifecycle.production,
      _targetLifecycle: seedIds.lifecycle.deprecated,
      _targetLifecycleDate: '2026-12-31',
      api_type: 'openapi',
      system: systemId
    });

    expect(created).toMatchObject({
      _name: 'Sunset API',
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      _targetLifecycle: expect.objectContaining({ id: seedIds.lifecycle.deprecated }),
      _targetLifecycleDate: '2026-12-31'
    });
  });

  test('PUT /api/:workspace/data/:id updates target lifecycle', async ({
    server,
    auth,
    seeded: _
  }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: apiSchemaId,
      _name: 'Future API',
      _lifecycle: seedIds.lifecycle.experimental,
      api_type: 'openapi',
      system: systemId
    });

    expect(created['_targetLifecycle']).toBeNull();

    const res = await fetch(`${server.baseUrl}/api/default/data/${created['_uid']}`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify({
        _schemaId: apiSchemaId,
        _name: 'Future API',
        _namespace: 'default',
        _lifecycle: seedIds.lifecycle.experimental,
        _targetLifecycle: seedIds.lifecycle.production,
        _targetLifecycleDate: '2026-09-30',
        api_type: 'openapi',
        system: systemId
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.experimental }),
      _targetLifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      _targetLifecycleDate: '2026-09-30'
    });
  });

  test('POST /api/:workspace/data silently nulls invalid target lifecycle', async ({
    server,
    auth,
    seeded: _
  }) => {
    const created = await createEntity(server.baseUrl, auth, {
      _schemaId: apiSchemaId,
      _name: 'Invalid Target API',
      _lifecycle: seedIds.lifecycle.production,
      _targetLifecycle: 'nonexistent-state',
      api_type: 'openapi',
      system: systemId
    });

    expect(created['_targetLifecycle']).toBeNull();
  });
});
