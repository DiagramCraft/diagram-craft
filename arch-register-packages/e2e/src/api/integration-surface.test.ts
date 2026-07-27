import { createApiTest, expect } from '../helpers/fixtures';
import { seedCatalogEntities } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

const entityId = '00000000-0000-0000-0003-000000000002';
const schemaId = '00000000-0000-0000-0000-000000000007';

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
});
