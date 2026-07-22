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
const defaultWorkspaceEntityCount = seedEntities.filter(
  entity => entity.workspace === seedIds.workspace.default
).length;

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
      query: {
        view: 'summary',
        _schemaId: componentSchemaId,
        owner: seedIds.teams.design,
        q: 'react'
      }
    });
    expect(body.items).toEqual([
      expect.objectContaining({
        _uid: componentId,
        _name: 'Frontend App',
        _owner: expect.objectContaining({ id: seedIds.teams.design }),
        _schema: expect.objectContaining({ id: componentSchemaId })
      })
    ]);
    expect(body.total).toBe(1);
    expect(body.items[0]).not.toHaveProperty('technology');
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
      total: defaultWorkspaceEntityCount,
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
    const res = await fetch(`${server.baseUrl}/api/default/data/export?_schemaId=${apiSchemaId}`, {
      headers: { Authorization: auth }
    });

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
    expect(body).toContain('"Technology Releases"');
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
      system: [systemId]
    });

    expect(created).toMatchObject({
      _name: 'Billing API',
      _slug: 'billing-api',
      _owner: expect.objectContaining({ id: seedIds.teams.design }),
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      api_type: 'openapi',
      system: [systemId]
    });
  });

  test('POST /api/:workspace/data/bulk resolves circular references transactionally', async ({
    orpc,
    seeded: _
  }) => {
    const created = await orpc.entities.bulkCreate({
      params: { workspace: 'default' },
      body: {
        entities: [
          {
            _schemaId: componentSchemaId,
            _name: 'Bulk Component A',
            system: [systemId],
            'Depends On': 'Bulk Component B'
          },
          {
            _schemaId: componentSchemaId,
            _name: 'Bulk Component B',
            system: [systemId],
            depends_on: 'Bulk Component A'
          }
        ]
      }
    });

    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      _name: 'Bulk Component A',
      depends_on: [created[1]!._uid]
    });
    expect(created[1]).toMatchObject({
      _name: 'Bulk Component B',
      depends_on: [created[0]!._uid]
    });
  });

  test('POST /api/:workspace/data/bulk rolls back every entity when a later write fails', async ({
    orpc,
    seeded: _
  }) => {
    await expect(
      orpc.entities.bulkCreate({
        params: { workspace: 'default' },
        body: {
          entities: [
            {
              _schemaId: componentSchemaId,
              _name: 'Rollback Component A',
              _slug: 'bulk-rollback-collision',
              system: [systemId]
            },
            {
              _schemaId: componentSchemaId,
              _name: 'Rollback Component B',
              _slug: 'bulk-rollback-collision',
              system: [systemId]
            }
          ]
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const matches = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { q: 'Rollback Component', view: 'summary' }
    });
    expect(matches.items).toEqual([]);
    expect(matches.total).toBe(0);
  });

  test('POST /api/:workspace/data/bulk rejects unresolved symbolic references without writes', async ({
    orpc,
    seeded: _
  }) => {
    await expect(
      orpc.entities.bulkCreate({
        params: { workspace: 'default' },
        body: {
          entities: [
            {
              _schemaId: componentSchemaId,
              _name: 'Unresolved Component',
              system: [systemId],
              depends_on: 'Missing Component'
            }
          ]
        }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const matches = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { q: 'Unresolved Component', view: 'summary' }
    });
    expect(matches.items).toEqual([]);
    expect(matches.total).toBe(0);
  });

  test('GET /api/:workspace/data/:id returns entity detail', async ({ orpc, seeded: _ }) => {
    const body = await orpc.entities.get({ params: { workspace: 'default', id: componentId } });
    expect(body).toMatchObject({
      _uid: componentId,
      _name: 'Frontend App',
      technology_releases: ['00000000-0000-0000-0006-000000000002'],
      depends_on: ['00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0003-000000000003']
    });
  });

  test('GET /api/:workspace/data/:id/relations returns incoming and outgoing relations', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.relations({
      params: { workspace: 'default', id: componentId }
    });
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

  test('POST /api/:workspace/data/batch-relations returns relations for multiple entities', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.batchRelations({
      params: { workspace: 'default' },
      body: { ids: [componentId, apiId, systemId] }
    });

    // Verify response structure
    expect(body).toHaveProperty(componentId);
    expect(body).toHaveProperty(apiId);
    expect(body).toHaveProperty(systemId);

    // Verify componentId relations
    expect(body[componentId]).toMatchObject({
      outgoing: expect.arrayContaining([
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
      ]),
      incoming: []
    });

    // Verify apiId has incoming relation from componentId
    expect(body[apiId]).toMatchObject({
      outgoing: expect.arrayContaining([
        expect.objectContaining({
          entityId: systemId,
          fieldName: 'System',
          kind: 'containment'
        })
      ]),
      incoming: expect.arrayContaining([
        expect.objectContaining({
          entityId: componentId,
          fieldName: 'Consumed APIs',
          kind: 'reference'
        })
      ])
    });

    // Verify systemId has incoming containment relations
    expect(body[systemId]).toBeDefined();
    expect(body[systemId]!.incoming).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: componentId,
          fieldName: 'System',
          kind: 'containment'
        }),
        expect.objectContaining({
          entityId: apiId,
          fieldName: 'System',
          kind: 'containment'
        })
      ])
    );
  });

  test('POST /api/:workspace/data/batch-relations handles non-existent entity IDs gracefully', async ({
    orpc,
    seeded: _
  }) => {
    const nonExistentId = '00000000-0000-0000-9999-999999999999';
    const body = await orpc.entities.batchRelations({
      params: { workspace: 'default' },
      body: { ids: [componentId, nonExistentId] }
    });

    // Should return relations for existing entity
    expect(body).toHaveProperty(componentId);
    expect(body[componentId]).toHaveProperty('outgoing');
    expect(body[componentId]).toHaveProperty('incoming');

    // Should not include non-existent entity
    expect(body).not.toHaveProperty(nonExistentId);
  });

  test('POST /api/:workspace/data/batch-relations returns empty object for empty ID list', async ({
    orpc,
    seeded: _
  }) => {
    const body = await orpc.entities.batchRelations({
      params: { workspace: 'default' },
      body: { ids: [] }
    });

    expect(body).toEqual({});
  });

  test('GET and PUT /api/:workspace/data/:id/access round-trip grants', async ({
    orpc,
    seeded: _
  }) => {
    const getBody = await orpc.entities.getAccess({
      params: { workspace: 'default', id: componentId }
    });
    expect(getBody).toMatchObject({
      owner: seedIds.teams.design,
      project_id: null,
      grants: []
    });

    const putBody = await orpc.entities.updateAccess({
      params: { workspace: 'default', id: componentId },
      body: {
        grants: [
          {
            principal_type: 'team',
            principal_id: seedIds.teams.platform,
            role: 'editor',
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
          role: 'editor',
          applies_to: 'subtree'
        })
      ]
    });
  });

  test('PUT /api/:workspace/data/:id/access rejects a viewer role grant', async ({
    orpc,
    seeded: _
  }) => {
    await expect(
      orpc.entities.updateAccess({
        params: { workspace: 'default', id: componentId },
        body: {
          grants: [
            {
              principal_type: 'team',
              principal_id: seedIds.teams.platform,
              role: 'viewer' as never,
              applies_to: 'subtree'
            }
          ]
        }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('PUT /api/:workspace/data/:id updates an entity', async ({ orpc, seeded: _ }) => {
    const created = await createEntity(orpc, {
      _schemaId: componentSchemaId,
      _name: 'Session Worker',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      technology: 'Node.js',
      system: [systemId]
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
        system: [systemId]
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

  test('POST /api/:workspace/data/:id/clone clones an entity', async ({ orpc, seeded: _ }) => {
    const body = await orpc.entities.clone({ params: { workspace: 'default', id: apiId } });
    expect(body).toMatchObject({
      _name: 'Customer API (copy)',
      _slug: 'customer-api-copy',
      api_type: 'openapi',
      system: [systemId]
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
      system: [systemId]
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
      system: [systemId]
    });

    const result = await orpc.entities.remove({
      params: { workspace: 'default', id: created._uid }
    });
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
      system: [systemId]
    });

    expect(created).toMatchObject({
      _name: 'Sunset API',
      _lifecycle: expect.objectContaining({ id: seedIds.lifecycle.production }),
      _targetLifecycle: expect.objectContaining({ id: seedIds.lifecycle.deprecated }),
      _targetLifecycleDate: '2026-12-31'
    });
  });

  test('PUT /api/:workspace/data/:id updates target lifecycle', async ({ orpc, seeded: _ }) => {
    const created = await createEntity(orpc, {
      _schemaId: apiSchemaId,
      _name: 'Future API',
      _lifecycle: seedIds.lifecycle.experimental,
      api_type: 'openapi',
      system: [systemId]
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
        system: [systemId]
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
      system: [systemId]
    });

    expect(created._targetLifecycle).toBeNull();
  });

  test('GET /api/:workspace/data filters by conditions _name contains', async ({
    orpc,
    seeded: _
  }) => {
    const conditions = [{ fieldId: '_name', op: 'contains', value: 'Auth' }];
    const body = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { conditions }
    });
    const names = body.items.map(e => e._name);
    expect(names).toEqual(expect.arrayContaining(['Auth Service', 'Auth API']));
    expect(names).not.toContain('API Gateway');
    expect(names).not.toContain('Engineering');
  });

  test('GET /api/:workspace/data filters by conditions _lifecycle equals', async ({
    orpc,
    seeded: _
  }) => {
    const conditions = JSON.stringify([
      { fieldId: '_lifecycle', op: 'equals', value: seedIds.lifecycle.experimental }
    ]);
    const body = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { _schemaId: componentSchemaId, conditions }
    });
    const expectedNames = seedEntities
      .filter(
        entity =>
          entity.workspace === seedIds.workspace.default &&
          entity.schema_id === componentSchemaId &&
          entity.lifecycle === seedIds.lifecycle.experimental
      )
      .map(entity => entity.name)
      .sort();
    expect(body.items.map(entity => entity._name).sort()).toEqual(expectedNames);
  });

  test('GET /api/:workspace/data filters by conditions _lifecycle empty', async ({
    orpc,
    seeded: _
  }) => {
    await orpc.entities.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: componentSchemaId,
        _name: 'No Lifecycle Component',
        system: [systemId]
      } as never
    });
    await orpc.entities.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: componentSchemaId,
        _name: 'Has Lifecycle Component',
        _lifecycle: seedIds.lifecycle.production,
        system: [systemId]
      } as never
    });

    const conditions = JSON.stringify([{ fieldId: '_lifecycle', op: 'empty', value: '' }]);
    const body = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { _schemaId: componentSchemaId, conditions }
    });
    const names = body.items.map(e => e._name);
    expect(names).toContain('No Lifecycle Component');
    expect(names).not.toContain('Has Lifecycle Component');
    expect(names).not.toContain('API Gateway');
  });
});
