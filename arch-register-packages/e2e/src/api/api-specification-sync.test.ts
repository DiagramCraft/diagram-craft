import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    const now = new Date();
    await server.db.catalog.createSchema({
      id: '00000000-0000-0000-0000-e2e000000111',
      workspace: seedIds.workspace.default,
      name: 'Integration API',
      description: '',
      fields: [
        { id: 'api_type', name: 'API type', type: 'text' },
        { id: 'api_version', name: 'API version', type: 'text' }
      ],
      templates: [],
      groups: [],
      shared_field_group_links: [],
      validation_rules: [],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'IAS',
      created_at: now,
      updated_at: now
    });
    await server.db.workspace.registerPublicIdPrefix(
      'IAS',
      'schema',
      '00000000-0000-0000-0000-e2e000000111',
      now
    );
    await server.db.workspace.upsertWorkspaceCapabilityConfiguration({
      id: '00000000-0000-0000-0000-c00000000111',
      workspace: seedIds.workspace.default,
      type: 'api-specification',
      bindings: {
        api: { target: { kind: 'entity_schema', id: '00000000-0000-0000-0000-e2e000000111' } }
      },
      created_at: now,
      updated_at: now
    });
  }
});

test('atomically syncs API entities and provider-scoped specification sources', async ({
  server,
  auth
}) => {
  const source = 'backstage-github-example';
  const externalKey = 'default/api/integration-api';
  const sourceKey =
    'github:example/catalog:catalog-info.yaml:default/api/integration-api:spec.definition';
  const endpoint = `${server.baseUrl}/api/integrations/v1/default/api-specifications/byExternalKey/${encodeURIComponent(source)}/${encodeURIComponent(externalKey)}`;
  const refreshEndpoint = `${endpoint}/refresh`;
  const document = (version: string) => `openapi: 3.0.0
info:
  title: Integration API
  version: ${version}
paths:
  /health:
    get:
      operationId: health
      responses:
        '200':
          description: ok
`;
  const sync = async (body: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.status !== 200) {
      throw new Error(
        `API specification sync returned ${response.status}: ${await response.text()}`
      );
    }
    return (await response.json()) as {
      status: string;
      sourceStatus: string | null;
      artifact: {
        id: string;
        status: string;
        sourceKey: string | null;
        currentRevisionId: string | null;
      } | null;
      revision: { id: string } | null;
    };
  };
  const present = (content: string) => ({
    entity: { _schemaId: '00000000-0000-0000-0000-e2e000000111', _name: 'Integration API' },
    source: {
      state: 'present',
      source: {
        kind: 'document',
        sourceKey,
        location: 'https://github.com/example/catalog/blob/main/openapi.yaml',
        mediaType: 'application/yaml',
        content
      }
    }
  });

  const first = await sync(present(document('1.0.0')));
  const repeated = await sync(present(document('1.0.0')));
  const changed = await sync(present(document('2.0.0')));
  const missing = await sync({
    entity: { _schemaId: '00000000-0000-0000-0000-e2e000000111', _name: 'Integration API' },
    source: { state: 'missing', sourceKey }
  });
  const urlSourceKey =
    'github:example/catalog:catalog-info.yaml:default/api/integration-api:remote';
  const url = await sync({
    entity: { _schemaId: '00000000-0000-0000-0000-e2e000000111', _name: 'Integration API' },
    source: {
      state: 'present',
      source: {
        kind: 'url',
        sourceKey: urlSourceKey,
        location: 'https://example.test/openapi.yaml',
        refreshPolicy: { mode: 'manual' }
      }
    }
  });
  const refreshResponse = await fetch(refreshEndpoint, {
    method: 'POST',
    headers: { Authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ sourceKey: urlSourceKey })
  });
  expect(refreshResponse.status).toBe(200);
  const refresh = (await refreshResponse.json()) as { status: string; artifact: { id: string } };
  expect(first).toMatchObject({
    status: 'created',
    sourceStatus: 'created',
    artifact: { sourceKey },
    revision: { id: expect.any(String) }
  });
  expect(repeated).toMatchObject({
    status: 'unchanged',
    sourceStatus: 'unchanged',
    revision: { id: first.revision?.id }
  });
  expect(changed).toMatchObject({
    sourceStatus: 'updated'
  });
  expect(changed.revision?.id).not.toBe(first.revision?.id);
  expect(missing).toMatchObject({
    sourceStatus: 'missing',
    artifact: { status: 'stale', currentRevisionId: changed.revision?.id }
  });
  expect(url).toMatchObject({ sourceStatus: 'queued', jobRunId: expect.any(String) });
  expect(refresh).toMatchObject({ status: 'deduplicated', artifact: { id: url.artifact?.id } });
});
