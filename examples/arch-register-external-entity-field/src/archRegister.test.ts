import assert from 'node:assert/strict';
import test from 'node:test';
import { ArchRegisterClient, entityToUpdateBody } from './archRegister.js';

const config = {
  host: '127.0.0.1',
  port: 3060,
  archRegisterUrl: 'http://arch-register.test',
  workspace: 'workspace/one',
  archRegisterToken: 'ar_pat_test',
  webhookSecret: 'whsec_test',
  sourceFieldId: 'github_repository',
  targetFieldId: 'latest_release'
} as const;

test('builds a complete external update body without computed response fields', () => {
  const body = entityToUpdateBody(
    {
      _uid: 'entity-1',
      _schema: { id: 'schema-1', name: 'Application' },
      _name: 'Payments',
      _slug: 'payments',
      _namespace: 'default',
      _description: 'Payment service',
      _owner: { id: 'team-1', name: 'Platform' },
      _lifecycle: { id: 'production', name: 'Production' },
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: ['payments'],
      _links: [],
      _visibilityMode: 'public',
      _externalMetadata: {},
      canView: true,
      github_repository: 'owner/repo',
      github_latest_release: 'v1.0.0'
    },
    'github_latest_release',
    'v2.0.0',
    { fieldId: 'github_latest_release', kind: 'integration', source: 'github-releases' }
  );

  assert.equal(body._schemaId, 'schema-1');
  assert.equal(body._owner, 'team-1');
  assert.equal(body.github_repository, 'owner/repo');
  assert.equal(body.github_latest_release, 'v2.0.0');
  assert.equal('_uid' in body, false);
  assert.equal('canView' in body, false);
  assert.equal('_external' in body, true);
});

test('uses the integration entity endpoints', async () => {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push(String(input));
    return new Response(
      JSON.stringify({
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
        latest_release: 'v1.0.0'
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };
  const client = new ArchRegisterClient(config, fetchImpl);

  await client.getEntity('entity-1');
  await client.updateEntity(
    {
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
      latest_release: 'v1.0.0'
    },
    'v2.0.0',
    { fieldId: 'latest_release', kind: 'integration', source: 'test' }
  );

  assert.deepEqual(requests, [
    'http://arch-register.test/api/integrations/v1/workspace%2Fone/entities/entity-1',
    'http://arch-register.test/api/integrations/v1/workspace%2Fone/entities/entity-1'
  ]);
});
