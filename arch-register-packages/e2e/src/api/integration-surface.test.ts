import { randomUUID } from 'node:crypto';
import { createApiTest, expect } from '../helpers/fixtures';
import type { TestServer } from '../helpers/serverHelper';
import { seedCatalogEntities, seedIds, seedIntegrationSyncData } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
    await seedIntegrationSyncData(server.db);
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

const settingsIntegrationSourceUrl = (baseUrl: string, source: string) =>
  `${baseUrl}/api/application/v1/default/config/integration-sources/${encodeURIComponent(source)}`;

const startIntegrationRun = async (
  server: TestServer,
  authorization: string,
  source: string,
  externalRunId: string
) => {
  const existing = await server.db.integrationSync.getSource(seedIds.workspace.default, source);
  const now = new Date();
  await server.db.integrationSync.upsertSource({
    id: existing?.id ?? randomUUID(),
    workspace: seedIds.workspace.default,
    source_key: source,
    display_name: source,
    type: 'e2e',
    owner: null,
    status: 'active',
    created_at: existing?.created_at ?? now,
    updated_at: now
  });
  const sourcePath = `/sync-sources/${encodeURIComponent(source)}`;
  const start = await fetch(integrationUrl(server.baseUrl, `${sourcePath}/runs`), {
    method: 'POST',
    headers: { Authorization: authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ externalRunId, coverage: 'partial' })
  });
  expect(start.status).toBe(200);
  return (await start.json()) as { id: string };
};

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
    const run = await startIntegrationRun(
      server,
      auth,
      'e2e',
      `entity-surface-${randomUUID()}`
    );
    const sync = await fetch(integrationUrl(server.baseUrl, externalPath), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...mutationBody('Integration Entity'),
        syncContext: { runId: run.id }
      })
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

  test('records source runs and protects missing detection from partial scans', async ({
    server,
    auth
  }) => {
    const source = 'e2e-control-center';
    const sourcePath = `/sync-sources/${source}`;
    const legacyRegistration = await fetch(integrationUrl(server.baseUrl, sourcePath), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: source, type: 'test', status: 'active' })
    });
    expect(legacyRegistration.status).not.toBe(200);
    const configure = await fetch(settingsIntegrationSourceUrl(server.baseUrl, source), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'E2E control center', type: 'test', status: 'active' })
    });
    expect(configure.status).toBe(200);

    const manualDegraded = await fetch(settingsIntegrationSourceUrl(server.baseUrl, source), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'E2E control center', type: 'test', status: 'degraded' })
    });
    expect(manualDegraded.status).not.toBe(200);

    const paused = await fetch(settingsIntegrationSourceUrl(server.baseUrl, source), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'E2E control center', type: 'test', status: 'paused' })
    });
    expect(paused.status).toBe(200);
    const blockedStart = await fetch(integrationUrl(server.baseUrl, `${sourcePath}/runs`), {
      method: 'POST',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ externalRunId: 'e2e-paused-run', coverage: 'partial' })
    });
    expect(blockedStart.status).not.toBe(200);

    const reactivated = await fetch(settingsIntegrationSourceUrl(server.baseUrl, source), {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'E2E control center', type: 'test', status: 'active' })
    });
    expect(reactivated.status).toBe(200);

    const start = await fetch(integrationUrl(server.baseUrl, `${sourcePath}/runs`), {
      method: 'POST',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        externalRunId: 'e2e-run-1',
        scopeKey: 'default',
        coverage: 'partial'
      })
    });
    expect(start.status).toBe(200);
    const run = await start.json();

    const repeatedStart = await fetch(integrationUrl(server.baseUrl, `${sourcePath}/runs`), {
      method: 'POST',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        externalRunId: 'e2e-run-1',
        scopeKey: 'default',
        coverage: 'partial'
      })
    });
    expect(repeatedStart.status).toBe(200);
    expect((await repeatedStart.json()).id).toBe(run.id);

    const sync = await fetch(
      integrationUrl(server.baseUrl, '/entities/byExternalKey/e2e-control-center/e2e-record'),
      {
        method: 'PUT',
        headers: { Authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({
          ...mutationBody('E2E managed record'),
          syncContext: { runId: run.id, scopeKey: 'default' }
        })
      }
    );
    expect(sync.status).toBe(200);

    const finish = await fetch(integrationUrl(server.baseUrl, `/sync-runs/${run.id}`), {
      method: 'PATCH',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'succeeded',
        coverage: 'partial',
        counts: { created: 1, updated: 0, unchanged: 0, failed: 0, warnings: 0 }
      })
    });
    expect(finish.status).toBe(200);

    const managedRecord = (await server.db.integrationSync.listManagedRecords(seedIds.workspace.default)).find(
      record => record.source_key === source && record.external_key === 'e2e-record'
    );
    expect(managedRecord).toBeDefined();
    await server.db.integrationSync.setManagedRecordState(
      seedIds.workspace.default,
      managedRecord!.id,
      'orphaned'
    );
    const relink = await fetch(
      integrationUrl(server.baseUrl, `/sync-records/${managedRecord!.id}/relink`),
      {
        method: 'POST',
        headers: { Authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({ recordId: entityId, confirm: true })
      }
    );
    expect(relink.status).toBe(200);
    expect((await server.db.externalIdentity.find(seedIds.workspace.default, source, 'e2e-record'))?.record_id).toBe(
      entityId
    );

    const sourceRow = await server.db.integrationSync.getSource(seedIds.workspace.default, source);
    expect(sourceRow).toBeDefined();
    const stopManagedId = randomUUID();
    const stopManagedExternalKey = 'e2e-stop-managed';
    const now = new Date();
    await server.db.integrationSync.upsertManagedRecord({
      id: stopManagedId,
      workspace: seedIds.workspace.default,
      source_id: sourceRow!.id,
      source_key: source,
      record_type: 'entity',
      external_key: stopManagedExternalKey,
      record_id: entityId,
      scope_key: null,
      last_seen_at: now,
      last_seen_run_id: run.id,
      updated_at: now
    });
    await server.db.externalIdentity.upsert({
      workspace: seedIds.workspace.default,
      source,
      external_key: stopManagedExternalKey,
      record_id: entityId
    });
    await server.db.integrationSync.setManagedRecordState(
      seedIds.workspace.default,
      stopManagedId,
      'orphaned'
    );
    const stopManaging = await fetch(
      integrationUrl(server.baseUrl, `/sync-records/${stopManagedId}/stop-managing`),
      {
        method: 'POST',
        headers: { Authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      }
    );
    expect(stopManaging.status).toBe(200);
    expect(
      await server.db.integrationSync.getManagedRecord(seedIds.workspace.default, stopManagedId)
    ).toBeNull();
    expect(
      await server.db.externalIdentity.find(
        seedIds.workspace.default,
        source,
        stopManagedExternalKey
      )
    ).toBeNull();
    expect(await server.db.catalog.getEntity(seedIds.workspace.default, entityId)).not.toBeNull();

    const dashboard = await fetch(integrationUrl(server.baseUrl, '/sync-control-center'), {
      headers: { Authorization: auth }
    });
    expect(dashboard.status).toBe(200);
    const dashboardBody = await dashboard.json();
    expect(dashboardBody.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceKey: source })])
    );
    expect(dashboardBody.runs).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: run.id, coverage: 'partial' })])
    );
    expect(dashboardBody.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalKey: 'e2e-record', state: 'active' }),
        expect.objectContaining({ state: 'missing' })
      ])
    );
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
    const run = await startIntegrationRun(
      server,
      `Bearer ${token.token}`,
      source,
      `restricted-${randomUUID()}`
    );
    const base = mutationBody('Restricted Sync Entity');

    const rejected = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...base,
        _schemaId: schemaId,
        visible: 'public',
        secret: 'changed',
        syncContext: { runId: run.id }
      })
    });
    expect(rejected.status).toBe(403);

    const unchanged = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...base,
        _schemaId: schemaId,
        visible: 'public',
        syncContext: { runId: run.id }
      })
    });
    expect(unchanged.status).toBe(200);
    expect((await unchanged.json()).status).toBe('unchanged');

    const stored = await server.db.catalog.getEntity(workspace, entityId);
    expect(stored?.data).toEqual({ visible: 'public', secret: 'private' });

    await orpc.authProtected.apiTokens.revoke({ params: { id: token.id } });
  });
});
