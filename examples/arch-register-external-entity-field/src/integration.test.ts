import assert from 'node:assert/strict';
import test from 'node:test';
import type { Config } from './config.js';
import { processWebhookEvent } from './integration.js';

const config: Config = {
  host: '127.0.0.1',
  port: 3060,
  archRegisterUrl: 'http://arch-register.test',
  workspace: 'default',
  archRegisterToken: 'ar_pat_test',
  webhookSecret: 'whsec_test',
  sourceFieldId: 'github_repository',
  targetFieldId: 'github_latest_release'
};

const entity = {
  _uid: 'entity-1',
  _schema: { id: 'schema-1', name: 'Application' },
  _name: 'Payments',
  _slug: 'payments',
  _namespace: 'default',
  _description: '',
  _owner: null,
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _tags: [],
  _links: [],
  _visibilityMode: 'public',
  github_repository: 'owner/repo',
  github_latest_release: 'v1.0.0'
};

test('hydrates a changed entity and writes the external envelope', async () => {
  const updates: Array<{ value: unknown; external: Record<string, unknown> }> = [];
  const client = {
    getEntity: async () => entity,
    updateEntity: async (
      _entity: Record<string, unknown>,
      value: unknown,
      external: Record<string, unknown>
    ) => {
      updates.push({ value, external });
      return entity;
    }
  } as never;

  const result = await processWebhookEvent(
    { version: '1', id: 'event-1', type: 'entity.updated', entity: { id: 'entity-1' } },
    config,
    client,
    async () =>
      new Response(
        JSON.stringify({
          id: 42,
          tag_name: 'v2.0.0',
          html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0',
          published_at: null
        }),
        { status: 200 }
      )
  );

  assert.equal(result, 'updated');
  assert.deepEqual(updates[0], {
    value: 'v2.0.0',
    external: {
      fieldId: 'github_latest_release',
      kind: 'integration',
      source: 'github-releases',
      status: 'success',
      requestId: 'event-1',
      sourceVersion: 'v2.0.0',
      explanation:
        'Latest GitHub release published at an unknown time: https://github.com/owner/repo/releases/tag/v2.0.0'
    }
  });
});

test('skips unchanged values and own external updates', async () => {
  let updateCount = 0;
  const client = {
    getEntity: async () => entity,
    updateEntity: async () => {
      updateCount += 1;
      return entity;
    }
  } as never;

  assert.equal(
    await processWebhookEvent(
      { version: '1', id: 'event-2', type: 'entity.updated', entity: { id: 'entity-1' } },
      config,
      client,
      async () =>
        new Response(
          JSON.stringify({
            id: 42,
            tag_name: 'v1.0.0',
            html_url: 'https://example.test',
            published_at: null
          }),
          { status: 200 }
        )
    ),
    'unchanged'
  );
  assert.equal(
    await processWebhookEvent(
      {
        version: '1',
        id: 'event-3',
        type: 'entity.updated',
        entity: { id: 'entity-1' },
        metadata: {
          external_kind: 'integration',
          external_field_id: 'github_latest_release',
          source: 'github-releases'
        }
      },
      config,
      client
    ),
    'ignored'
  );
  assert.equal(updateCount, 0);
});
