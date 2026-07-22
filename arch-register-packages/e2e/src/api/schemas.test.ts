import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import { SCHEMA_REF_ENTITY_ID, NONEXISTENT_UUID } from '../helpers/testIds';

const apiSchemaId = '00000000-0000-0000-0000-000000000004';
const apiTypeEnumId = '00000000-0000-0000-0000-e00000000001';

test.describe('schema routes', () => {
  test('GET /api/:workspace/schemas returns seeded schemas with expanded select options', async ({
    orpc
  }) => {
    const schemas = await orpc.schemas.list({ params: { workspace: 'default' } });
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: apiSchemaId,
          workspace: seedIds.workspace.default,
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
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.schemas.list({ params: { workspace: 'default' } })).rejects.toMatchObject(
      {
        code: 'UNAUTHORIZED'
      }
    );
  });

  test('GET /api/:workspace/schemas returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(orpc.schemas.list({ params: { workspace: 'nonexistent' } })).rejects.toMatchObject(
      { code: 'NOT_FOUND' }
    );
  });

  test('GET /api/:workspace/schemas/:id returns a seeded schema by id', async ({ orpc }) => {
    const schema = await orpc.schemas.get({ params: { workspace: 'default', id: apiSchemaId } });
    expect(schema).toMatchObject({
      id: apiSchemaId,
      workspace: seedIds.workspace.default,
      name: 'API'
    });
  });

  test('GET /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({ orpc }) => {
    await expect(
      orpc.schemas.get({ params: { workspace: 'default', id: NONEXISTENT_UUID } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('POST /api/:workspace/schemas creates a schema with normalized optional fields', async ({
    orpc
  }) => {
    const schema = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: 'Capability', icon: 'star' }
    });
    expect(schema).toMatchObject({
      workspace: seedIds.workspace.default,
      name: 'Capability',
      description: '',
      fields: [],
      color: null,
      icon: 'star'
    });
  });

  test('POST /api/:workspace/schemas creates a schema with explicit fields and default owner', async ({
    orpc
  }) => {
    const schema = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: {
        name: 'Service',
        description: 'Deployable service',
        color: '#112233',
        icon: 'server',
        default_owner: seedIds.teams.platform,
        fields: [
          { id: 'runtime', name: 'Runtime', type: 'text' },
          { id: 'tier', name: 'Tier', type: 'select', enumId: apiTypeEnumId }
        ]
      }
    });
    expect(schema).toMatchObject({
      workspace: seedIds.workspace.default,
      name: 'Service',
      description: 'Deployable service',
      color: '#112233',
      icon: 'server'
    });
    expect(schema.id).toEqual(expect.any(String));
    expect(schema.fields).toEqual(
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
    orpc
  }) => {
    await expect(
      orpc.schemas.create({
        params: { workspace: 'default' },
        body: { name: undefined as unknown as string }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('POST /api/:workspace/schemas returns 409 for a duplicate schema name', async ({ orpc }) => {
    await expect(
      orpc.schemas.create({ params: { workspace: 'default' }, body: { name: 'API' } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A schema with that name already exists in this workspace'
    });
  });

  test('PUT /api/:workspace/schemas/:id updates a schema and preserves omitted fields', async ({
    orpc
  }) => {
    const created = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: {
        name: 'Bounded Context',
        description: 'Original description',
        color: '#abcdef',
        icon: 'layers',
        default_owner: seedIds.teams.platform,
        fields: [{ id: 'mission', name: 'Mission', type: 'text' }]
      }
    });

    const updated = await orpc.schemas.update({
      params: { workspace: 'default', id: created.id },
      body: { name: 'Context Boundary' }
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Context Boundary',
      description: 'Original description',
      color: '#abcdef',
      icon: 'layers',
      fields: [expect.objectContaining({ id: 'mission', type: 'text' })]
    });
  });

  test('PUT /api/:workspace/schemas/:id replaces explicit mutable fields', async ({ orpc }) => {
    const created = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: {
        name: 'Integration',
        description: 'Original',
        color: '#aabbcc',
        icon: 'plug',
        default_owner: seedIds.teams.platform,
        fields: [{ id: 'protocol', name: 'Protocol', type: 'text' }]
      }
    });

    const updated = await orpc.schemas.update({
      params: { workspace: 'default', id: created.id },
      body: {
        name: 'Integration Surface',
        description: '',
        color: null,
        icon: null,
        default_owner: seedIds.teams.design,
        fields: [{ id: 'type', name: 'Type', type: 'select', enumId: apiTypeEnumId }]
      }
    });
    expect(updated).toMatchObject({
      id: created.id,
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

  test('PUT /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({ orpc }) => {
    await expect(
      orpc.schemas.update({
        params: { workspace: 'default', id: NONEXISTENT_UUID },
        body: { name: 'Nope' }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('DELETE /api/:workspace/schemas/:id deletes an unreferenced schema', async ({ orpc }) => {
    const created = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: 'Temporary Schema' }
    });

    const result = await orpc.schemas.remove({ params: { workspace: 'default', id: created.id } });
    expect(result).toMatchObject({ success: true, message: `Schema '${created.id}' deleted` });
  });

  test('DELETE /api/:workspace/schemas/:id returns 409 for a referenced seeded schema', async ({
    server,
    orpc
  }) => {
    await server.db.catalog.createEntity({
      id: SCHEMA_REF_ENTITY_ID,
      workspace: seedIds.workspace.default,
      public_id: 'API-99',
      slug: 'schema-ref-entity',
      namespace: 'default',
      name: 'Schema Ref Entity',
      description: '',
      owner: seedIds.teams.platform,
      lifecycle: seedIds.lifecycle.production,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: apiSchemaId,
      data: {},
      visibility_mode: null,
      project_id: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    await expect(
      orpc.schemas.remove({ params: { workspace: 'default', id: apiSchemaId } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Cannot delete schema: entities still reference it'
    });
  });

  test('DELETE /api/:workspace/schemas/:id returns 404 for an unknown schema id', async ({
    orpc
  }) => {
    await expect(
      orpc.schemas.remove({ params: { workspace: 'default', id: NONEXISTENT_UUID } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
