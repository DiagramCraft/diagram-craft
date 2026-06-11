import { seedEntities } from '@arch-register/server/db/seedData';
import { expect, test as baseTest, createTestORPCClient } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';

const test = baseTest.extend<{ seeded: true }>({
  seeded: [
    async ({ server }, use) => {
      await seedCatalogEntities(server.db);
      await use(true);
    },
    { scope: 'file' }
  ]
});

const domainId = '00000000-0000-0000-0001-000000000001';
const systemId = '00000000-0000-0000-0002-000000000001';
const apiId = '00000000-0000-0000-0004-000000000001';
const componentId = '00000000-0000-0000-0003-000000000002';
const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const apiSchemaId = '00000000-0000-0000-0000-000000000004';

const createEntity = async (orpc: TestORPCClient, body: Record<string, unknown>) => {
  return await orpc.entities.create({ params: { workspace: 'default' }, body: body as never });
};

test.describe('data routes', () => {
  test('GET /api/:workspace/data lists seeded entities and supports summary filters', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { view: 'summary', _schemaId: componentSchemaId, owner: seedIds.teams.design, q: 'react' }
    });
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
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.entities.list({ params: { workspace: 'default' }, query: {} })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('GET /api/:workspace/data/facets returns counts for seeded entities', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.facets({ params: { workspace: 'default' } });
    expect(body).toMatchObject({
      total: seedEntities.length,
      completeness: {
        below50: expect.any(Number),
        below80: expect.any(Number),
        above80: expect.any(Number)
      }
    });
  });

  test('GET /api/:workspace/data/tree returns matches with ancestor edges', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.tree({
      params: { workspace: 'default' },
      query: { q: 'frontend' }
    });
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
      `${server.baseUrl}/api/default/data/export?_schemaId=${apiSchemaId}`,
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
      `${server.baseUrl}/api/default/data/import/template/${componentSchemaId}`,
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
    orpc,
    seeded: _
  }) => {
    const csvContent = [
      '"Name";"Slug";"Namespace";"Description";"Technology";"System"',
      '"Frontend App";"frontend-app";"default";"Updated from CSV";"React";"Customer Portal"'
    ].join('\n');

    const body = await orpc.entities.importParse({
      params: { workspace: 'default' },
      body: { schemaId: componentSchemaId, csvContent }
    });

    expect(body.validRows).toBe(1);
    expect(body.entities[0]).toMatchObject({
      isUpdate: true,
      matchType: 'slug',
      existingId: componentId
    });
  });

  test('POST /api/:workspace/data creates an entity and inherits owner from its parent', async ({
    orpc,
    seeded: _
  }) => {
    const created = await createEntity(orpc, {
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
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.get({ params: { workspace: 'default', id: componentId } });
    expect(body).toMatchObject({
      _uid: componentId,
      _name: 'Frontend App',
      technology: 'React',
      depends_on: '00000000-0000-0000-0003-000000000001'
    });
  });

  test('GET /api/:workspace/data/:id/relations returns incoming and outgoing relations', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.relations({ params: { workspace: 'default', id: componentId } });
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
    orpc,
    seeded: _
  }) => {
    const getBody = await orpc.entities.getAccess({ params: { workspace: 'default', id: componentId } });
    expect(getBody).toMatchObject({
      owner: seedIds.teams.design,
      visibility_mode: null,
      grants: []
    });

    const putBody = await orpc.entities.updateAccess({
      params: { workspace: 'default', id: componentId },
      body: {
        grants: [
          {
            principal_type: 'team',
            principal_id: seedIds.teams.platform,
            role: 'viewer',
            applies_to: 'subtree'
          }
        ]
      }
    });

    expect(putBody).toMatchObject({
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

  test('PUT /api/:workspace/data/:id updates an entity', async ({ orpc, seeded: _ }) => {
    const created = await createEntity(orpc, {
      _schemaId: componentSchemaId,
      _name: 'Session Worker',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      technology: 'Node.js',
      system: systemId
    });

    const updated = await orpc.entities.update({
      params: { workspace: 'default', id: created._uid },
      body: {
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
      } as never
    });

    expect(updated).toMatchObject({
      _uid: created._uid,
      _name: 'Session Worker v2',
      _slug: 'session-worker-v2',
      _owner: expect.objectContaining({ id: seedIds.teams.security }),
      _visibilityMode: 'restricted',
      technology: 'Go'
    });
  });

  test('POST /api/:workspace/data/:id/clone clones an entity', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.clone({ params: { workspace: 'default', id: apiId } });
    expect(body).toMatchObject({
      _name: 'Customer API (copy)',
      _slug: 'customer-api-copy',
      api_type: 'openapi',
      system: systemId
    });
  });

  test('POST /api/:workspace/data/import/commit creates and updates entities', async ({
    orpc,
    seeded: _
  }) => {
    const created = await createEntity(orpc, {
      _schemaId: componentSchemaId,
      _name: 'CSV Worker',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      technology: 'TypeScript',
      system: systemId
    });

    const body = await orpc.entities.importCommit({
      params: { workspace: 'default' },
      body: {
        schemaId: componentSchemaId,
        entities: [
          {
            _existingId: created._uid,
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
      }
    });

    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.ids).toHaveLength(2);

    const importedEntities = await Promise.all(
      body.ids.map(id => orpc.entities.get({ params: { workspace: 'default', id } }))
    );

    expect(importedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _name: 'Import-created Component',
          technology: 'React'
        }),
        expect.objectContaining({
          _uid: created._uid,
          _name: 'CSV Worker Updated',
          technology: 'Rust'
        })
      ])
    );
  });

  test('DELETE /api/:workspace/data/:id deletes an entity', async ({ orpc, seeded: _ }) => {
    const created = await createEntity(orpc, {
      _schemaId: apiSchemaId,
      _name: 'Delete Me API',
      api_type: 'graphql',
      system: systemId
    });

    const result = await orpc.entities.remove({ params: { workspace: 'default', id: created._uid } });
    expect(result).toMatchObject({
      success: true,
      message: `Data record '${created._uid}' deleted`
    });
  });

  test('returns 404 for unknown workspace', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.entities.list({ params: { workspace: 'nonexistent' }, query: {} })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('POST /api/:workspace/data creates entity with target lifecycle and date', async ({
    orpc,
    seeded: _
  }) => {
    const created = await createEntity(orpc, {
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
    orpc,
    seeded: _
  }) => {
    const created = await createEntity(orpc, {
      _schemaId: apiSchemaId,
      _name: 'Future API',
      _lifecycle: seedIds.lifecycle.experimental,
      api_type: 'openapi',
      system: systemId
    });

    expect(created._targetLifecycle).toBeNull();

    const updated = await orpc.entities.update({
      params: { workspace: 'default', id: created._uid },
      body: {
        _schemaId: apiSchemaId,
        _name: 'Future API',
        _namespace: 'default',
        _lifecycle: seedIds.lifecycle.experimental,
        _targetLifecycle: seedIds.lifecycle.production,
        _targetLifecycleDate: '2026-09-30',
        api_type: 'openapi',
        system: systemId
      } as never
    });

    expect(updated).toMatchObject({
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.experimental }),
      _targetLifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      _targetLifecycleDate: '2026-09-30'
    });
  });

  test('POST /api/:workspace/data silently nulls invalid target lifecycle', async ({
    orpc,
    seeded: _
  }) => {
    const created = await createEntity(orpc, {
      _schemaId: apiSchemaId,
      _name: 'Invalid Target API',
      _lifecycle: seedIds.lifecycle.production,
      _targetLifecycle: 'nonexistent-state',
      api_type: 'openapi',
      system: systemId
    });

    expect(created._targetLifecycle).toBeNull();
  });
});
