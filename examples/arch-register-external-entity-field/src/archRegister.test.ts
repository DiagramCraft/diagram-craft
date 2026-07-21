import assert from 'node:assert/strict';
import test from 'node:test';
import { entityToUpdateBody } from './archRegister.js';

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
