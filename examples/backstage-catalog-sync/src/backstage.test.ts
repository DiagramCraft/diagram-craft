import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateExternalKey,
  isSupportedKind,
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
});
