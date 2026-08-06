import { randomUUID } from 'node:crypto';
import { createApiTest, expect } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

const entityId = '00000000-0000-0000-0003-000000000002';
const schemaId = '00000000-0000-0000-0000-000000000007';
const relationSchemaId = '00000000-0000-0000-0000-000000000030';
const relationId = '00000000-0000-0000-0009-000000000001';
const relationInEntityId = '00000000-0000-0000-0002-000000000001';
const relationOutEntityId = '00000000-0000-0000-0002-000000000002';

const integrationUrl = (baseUrl: string, path: string) =>
  `${baseUrl}/api/integrations/v1/default${path}`;

const mutationBody = (name: string) => ({
  _schemaId: schemaId,
  _name: name,
  _slug: name.toLowerCase().replaceAll(' ', '-'),
  _namespace: 'default',
  _description: '',
  _owner: null,
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _tags: [],
  _links: []
});

test.describe('integration entity surface', () => {
  test('exposes typed relation metadata, paginated reads, and CRUD', async ({ server, auth }) => {
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace: seedIds.workspace.default,
      name: 'Integration Data Flow',
      description: '',
      in_schema_ids: ['00000000-0000-0000-0000-000000000002'],
      out_schema_ids: ['00000000-0000-0000-0000-000000000002'],
      fields: [{ id: 'protocol', name: 'Protocol', type: 'text', requirementLevel: 'optional' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: now,
      updated_at: now
    });
    await server.db.relation.createRelation({
      id: relationId,
      workspace: seedIds.workspace.default,
      schema_id: relationSchemaId,
      in_entity_id: relationInEntityId,
      out_entity_id: relationOutEntityId,
      data: { protocol: 'https' },
      created_at: now,
      updated_at: now
    });

    const schemas = await fetch(integrationUrl(server.baseUrl, '/relation-schemas'), {
      headers: { Authorization: auth }
    });
    expect(schemas.status).toBe(200);
    expect(
      (await schemas.json()).some((schema: { id: string }) => schema.id === relationSchemaId)
    ).toBe(true);

    const page = await fetch(
      integrationUrl(server.baseUrl, `/relations?schemaId=${relationSchemaId}&limit=1&offset=0`),
      { headers: { Authorization: auth } }
    );
    expect(page.status).toBe(200);
    const pageBody = await page.json();
    expect(pageBody.total).toBeGreaterThan(0);
    expect(pageBody.items).toHaveLength(1);

    const entityRelations = await fetch(
      integrationUrl(server.baseUrl, `/data/${relationInEntityId}/typed-relations`),
      { headers: { Authorization: auth } }
    );
    expect(entityRelations.status).toBe(200);
    expect((await entityRelations.json()).outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ _uid: relationId })])
    );

    const created = await fetch(integrationUrl(server.baseUrl, '/relations'), {
      method: 'POST',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        _schemaId: relationSchemaId,
        _inEntityId: relationInEntityId,
        _outEntityId: relationOutEntityId,
        protocol: 'https'
      })
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.protocol).toBe('https');

    const updated = await fetch(integrationUrl(server.baseUrl, `/relations/${createdBody._uid}`), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ protocol: 'grpc' })
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).protocol).toBe('grpc');

    const deleted = await fetch(integrationUrl(server.baseUrl, `/relations/${createdBody._uid}`), {
      method: 'DELETE',
      headers: { Authorization: auth }
    });
    expect(deleted.status).toBe(200);
  });

  test('supports entity ID and external identity reads and writes', async ({ server, auth }) => {
    const byId = await fetch(integrationUrl(server.baseUrl, `/entities/${entityId}`), {
      headers: { Authorization: auth }
    });
    expect(byId.status).toBe(200);
    expect((await byId.json())._uid).toBe(entityId);

    const externalPath = '/entities/byExternalKey/e2e/integration-entity';
    const sync = await fetch(integrationUrl(server.baseUrl, externalPath), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify(mutationBody('Integration Entity'))
    });
    const syncText = await sync.text();
    expect(sync.status, syncText).toBe(200);
    expect(JSON.parse(syncText).status).toBe('created');

    const byExternalKey = await fetch(integrationUrl(server.baseUrl, externalPath), {
      headers: { Authorization: auth }
    });
    expect(byExternalKey.status).toBe(200);
    const syncedEntity = await byExternalKey.json();

    const update = await fetch(integrationUrl(server.baseUrl, `/entities/${syncedEntity._uid}`), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify(mutationBody('Updated Integration Entity'))
    });
    expect(update.status).toBe(200);
    expect((await update.json())._name).toBe('Updated Integration Entity');
  });

  test('requires authentication and the external-update capability for mutation', async ({
    server,
    orpc
  }) => {
    const path = `/entities/${entityId}`;
    const anonymous = await fetch(integrationUrl(server.baseUrl, path), { method: 'PUT' });
    expect(anonymous.status).toBe(401);

    const token = await orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'Integration read-only test',
        capabilities: ['ws.view', 'content.view']
      }
    });
    const readOnly = await fetch(integrationUrl(server.baseUrl, path), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(mutationBody('Should be rejected'))
    });
    expect(readOnly.status).toBe(403);

    await orpc.authProtected.apiTokens.revoke({ params: { id: token.id } });
  });

  test('enforces restricted field writes and hides restricted data from sync status', async ({
    server,
    orpc
  }) => {
    const workspace = seedIds.workspace.default;
    const schemaId = randomUUID();
    const entityId = randomUUID();
    const source = 'issue-2608';
    const externalKey = 'restricted-sync-entity';
    const now = new Date();

    await server.db.catalog.createSchema({
      id: schemaId,
      workspace,
      name: 'Restricted sync test',
      description: '',
      fields: [
        { id: 'visible', name: 'Visible', type: 'text', requirementLevel: null },
        {
          id: 'secret',
          name: 'Secret',
          type: 'text',
          requirementLevel: null,
          groupId: 'restricted'
        }
      ],
      groups: [
        {
          id: 'restricted',
          name: 'Restricted',
          accessControl: { teamIds: [seedIds.teams.security] }
        }
      ],
      templates: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'R2608',
      created_at: now,
      updated_at: now
    });
    await server.db.workspace.registerPublicIdPrefix('R2608', 'schema', schemaId, now);
    await server.db.catalog.createEntity({
      id: entityId,
      workspace,
      public_id: 'R2608-001',
      slug: 'restricted-sync-entity',
      namespace: 'default',
      name: 'Restricted Sync Entity',
      description: '',
      owner: null,
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: schemaId,
      data: { visible: 'public', secret: 'private' },
      project_id: null,
      created_at: now,
      updated_at: now,
      completeness: 0
    });
    await server.db.externalIdentity.create({
      workspace,
      source,
      external_key: externalKey,
      record_id: entityId
    });

    const token = await orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'Restricted sync regression',
        capabilities: ['ws.view', 'content.view', 'ent.edit', 'ent.external_update']
      }
    });
    const url = integrationUrl(server.baseUrl, `/entities/byExternalKey/${source}/${externalKey}`);
    const base = mutationBody('Restricted Sync Entity');

    const rejected = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...base, _schemaId: schemaId, visible: 'public', secret: 'changed' })
    });
    expect(rejected.status).toBe(403);

    const unchanged = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...base, _schemaId: schemaId, visible: 'public' })
    });
    expect(unchanged.status).toBe(200);
    expect((await unchanged.json()).status).toBe('unchanged');

    const stored = await server.db.catalog.getEntity(workspace, entityId);
    expect(stored?.data).toEqual({ visible: 'public', secret: 'private' });

    await orpc.authProtected.apiTokens.revoke({ params: { id: token.id } });
  });
});
