import { describe, expect, it } from 'vitest';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { buildContainmentChildrenIndex, collectDescendantIds } from './metricDescendants';

const now = new Date('2026-01-01T00:00:00.000Z');

const makeSchema = (id: string, containmentTargetSchemaId: string | null): SchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name: id,
  description: '',
  fields:
    containmentTargetSchemaId == null
      ? []
      : [
          {
            id: 'parent',
            name: 'Parent',
            type: 'containment',
            schemaId: containmentTargetSchemaId,
            minCount: 0,
            maxCount: 1,
            requirementLevel: 'optional'
          }
        ],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: id.toUpperCase().slice(0, 3),
  created_at: now,
  updated_at: now
});

const makeEntity = (
  id: string,
  schemaId: string,
  parentId: string | null,
  overrides: Partial<EntityDbResult> = {}
): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: id.toUpperCase(),
  slug: id,
  namespace: '',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: schemaId,
  data: parentId == null ? {} : { parent: parentId },
  visibility_mode: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: schemaId,
  ...overrides
});

describe('buildContainmentChildrenIndex / collectDescendantIds', () => {
  const domainSchema = makeSchema('domain', null);
  const capabilitySchema = makeSchema('capability', 'domain');
  const serviceSchema = makeSchema('service', 'capability');
  const schemas = [domainSchema, capabilitySchema, serviceSchema];

  it('returns an empty descendant list for a box with no children', () => {
    const entities = [makeEntity('d1', 'domain', null)];
    const index = buildContainmentChildrenIndex(schemas, entities);
    expect(collectDescendantIds('d1', index)).toEqual([]);
  });

  it('collects a deep multi-level subtree, excluding the box itself', () => {
    const entities = [
      makeEntity('d1', 'domain', null),
      makeEntity('c1', 'capability', 'd1'),
      makeEntity('c2', 'capability', 'd1'),
      makeEntity('s1', 'service', 'c1'),
      makeEntity('s2', 'service', 'c1'),
      makeEntity('s3', 'service', 'c2')
    ];
    const index = buildContainmentChildrenIndex(schemas, entities);
    const descendants = collectDescendantIds('d1', index).sort();
    expect(descendants).toEqual(['c1', 'c2', 's1', 's2', 's3']);
    expect(descendants).not.toContain('d1');
  });

  it('only collects descendants reachable through the requested box (partial subtree)', () => {
    const entities = [
      makeEntity('d1', 'domain', null),
      makeEntity('d2', 'domain', null),
      makeEntity('c1', 'capability', 'd1'),
      makeEntity('c2', 'capability', 'd2')
    ];
    const index = buildContainmentChildrenIndex(schemas, entities);
    expect(collectDescendantIds('d1', index)).toEqual(['c1']);
    expect(collectDescendantIds('d2', index)).toEqual(['c2']);
  });

  it('does not hang or duplicate when containment data forms a cycle', () => {
    // Malformed data: c1's parent is c2, and c2's parent is c1.
    const entities = [makeEntity('c1', 'capability', 'c2'), makeEntity('c2', 'capability', 'c1')];
    const index = buildContainmentChildrenIndex(schemas, entities);
    const descendants = collectDescendantIds('c1', index);
    expect(new Set(descendants).size).toBe(descendants.length);
    expect(descendants.length).toBeLessThan(10);
  });
});
