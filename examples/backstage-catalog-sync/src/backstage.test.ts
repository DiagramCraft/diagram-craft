import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateExternalKey,
  canonicalReferenceKey,
  isSupportedKind,
  parseBackstageReference,
  parseBackstageYaml,
  validateEntity
} from './backstage.js';

describe('Backstage parsing and validation', () => {
  it('parses multi-document catalog YAML', () => {
    const entities = parseBackstageYaml(`
apiVersion: backstage.io/v1alpha1
kind: Domain
metadata:
  name: artists
spec: {}
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: artist-web
spec:
  type: website
`);

    assert.equal(entities.length, 2);
    assert.equal(entities[1]?.metadata.name, 'artist-web');
  });

  it('reports missing required entity fields', () => {
    const entity = parseBackstageYaml(`
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  description: Missing a name
spec: {}
`)[0]!;

    assert.deepEqual(validateEntity(entity), {
      valid: false,
      errors: ['Missing required field: metadata.name']
    });
  });

  it('generates a stable external key', () => {
    const entity = parseBackstageYaml(`
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: artist-web
  namespace: production
spec: {}
`)[0]!;

    assert.equal(generateExternalKey(entity), 'production/component/artist-web');
  });

  it('recognizes only supported kinds', () => {
    assert.equal(isSupportedKind('Component'), true);
    assert.equal(isSupportedKind('User'), false);
  });

  it('parses Backstage references with field defaults', () => {
    assert.deepEqual(parseBackstageReference('system:default/my-system', 'system'), {
      kind: 'system', namespace: 'default', name: 'my-system'
    });
    assert.deepEqual(parseBackstageReference('default/my-system', 'system'), {
      kind: 'system', namespace: 'default', name: 'my-system'
    });
    assert.deepEqual(parseBackstageReference('my-system', 'system'), {
      kind: 'system', namespace: 'default', name: 'my-system'
    });
    assert.deepEqual(parseBackstageReference({ kind: 'API', name: 'artist-api' }, 'system'), {
      kind: 'api', namespace: 'default', name: 'artist-api'
    });
  });

  it('rejects malformed references and creates canonical keys', () => {
    assert.equal(parseBackstageReference('system:default/too/many/parts', 'system'), null);
    assert.equal(parseBackstageReference('system:', 'system'), null);
    assert.equal(
      canonicalReferenceKey({ kind: 'System', namespace: 'default', name: 'my-system' }),
      'default/system/my-system'
    );
  });
});
