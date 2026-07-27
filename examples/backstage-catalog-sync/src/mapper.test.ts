import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapBackstageToArchRegister } from './mapper.js';
import type { BackstageEntity } from './backstage.js';

const schemaMapping = {
  component: 'component-schema',
  api: 'api-schema',
  resource: 'resource-schema',
  system: 'system-schema',
  domain: 'domain-schema'
};

const component: BackstageEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'artist-web',
    title: 'Artist Web',
    namespace: 'default',
    description: 'The web application',
    tags: ['frontend'],
    annotations: { 'backstage.io/techdocs-ref': 'dir:.' }
  },
  spec: {
    type: 'website',
    lifecycle: 'production',
    owner: 'group:default/platform',
    system: 'system:default/artists'
  }
};

describe('Backstage entity mapping', () => {
  it('maps common and scalar component fields', () => {
    const result = mapBackstageToArchRegister(component, schemaMapping);

    assert.deepEqual(result.errors, []);
    assert.equal(result.entity?._schemaId, 'component-schema');
    assert.equal(result.entity?._name, 'Artist Web');
    assert.equal(result.entity?.kind, 'website');
    assert.equal(result.entity?.technology, 'dir:.');
    assert.deepEqual(result.entity?._tags, ['frontend']);
  });

  it('retains relationship references separately from Arch Register fields', () => {
    const result = mapBackstageToArchRegister(component, schemaMapping);

    assert.equal('system' in (result.entity ?? {}), false);
    assert.deepEqual(result.relationships, [
      { field: 'system', defaultKind: 'system', references: ['system:default/artists'] },
      { field: 'providesApis', defaultKind: 'api', references: [] },
      { field: 'consumesApis', defaultKind: 'api', references: [] }
    ]);
    assert.equal(
      result.warnings.some(warning => warning.includes('spec.system')),
      false
    );
  });

  it('reports a missing schema mapping', () => {
    const result = mapBackstageToArchRegister(component, {});

    assert.equal(result.entity, null);
    assert.deepEqual(result.relationships, []);
    assert.deepEqual(result.errors, [
      "No schema mapping found for kind 'Component'. Configure SCHEMA_COMPONENT or ensure schema auto-discovery is working."
    ]);
  });

  it('maps the relationship path for each supported kind', () => {
    const makeEntity = (kind: string, field: string, value: unknown): BackstageEntity => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind,
      metadata: { name: `${kind.toLowerCase()}-one` },
      spec: { [field]: value }
    });

    assert.equal(
      mapBackstageToArchRegister(makeEntity('Component', 'system', 'my-system'), schemaMapping)
        .relationships[0]?.field,
      'system'
    );
    assert.equal(
      mapBackstageToArchRegister(makeEntity('API', 'system', 'my-system'), schemaMapping)
        .relationships[0]?.defaultKind,
      'system'
    );
    assert.equal(
      mapBackstageToArchRegister(makeEntity('Resource', 'system', 'my-system'), schemaMapping)
        .relationships[0]?.field,
      'system'
    );
    assert.equal(
      mapBackstageToArchRegister(makeEntity('System', 'domain', 'my-domain'), schemaMapping)
        .relationships[0]?.defaultKind,
      'domain'
    );
    assert.deepEqual(
      mapBackstageToArchRegister(makeEntity('Domain', 'unused', 'ignored'), schemaMapping)
        .relationships,
      []
    );
  });
});
