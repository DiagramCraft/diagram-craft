import { describe, expect, it } from 'vitest';
import {
  filterBlastRadiusEntities,
  uniqueProvenanceHopIds,
  viaSchemaIdsForEntity,
  type BlastRadiusEntity
} from './blastRadiusFilters';

const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });

const entity = (overrides: Partial<BlastRadiusEntity> = {}): BlastRadiusEntity => ({
  entityId: 'e1',
  entityName: 'Entity 1',
  entitySlug: 'entity-1',
  schemaId: 'schema-a',
  schemaName: 'Schema A',
  ownerId: 'team-1',
  lifecycleState: null,
  criticality: null,
  depth: 1,
  rank: 1,
  paths: [
    {
      rootId: 'root',
      pathId: 'blast-radius',
      depth: 1,
      provenance: [hop('root', 'schema-root'), hop('e1', 'schema-a')]
    }
  ],
  ...overrides
});

describe('filterBlastRadiusEntities', () => {
  it('returns everything when no filters are set', () => {
    const entities = [entity(), entity({ entityId: 'e2' })];
    expect(filterBlastRadiusEntities(entities, { ownerId: null, schemaIds: null, viaSchemaIds: null })).toHaveLength(
      2
    );
  });

  it('filters by owner', () => {
    const entities = [entity({ ownerId: 'team-1' }), entity({ entityId: 'e2', ownerId: 'team-2' })];
    const result = filterBlastRadiusEntities(entities, {
      ownerId: 'team-2',
      schemaIds: null,
      viaSchemaIds: null
    });
    expect(result.map(e => e.entityId)).toEqual(['e2']);
  });

  it('filters by entity schema', () => {
    const entities = [entity({ schemaId: 'schema-a' }), entity({ entityId: 'e2', schemaId: 'schema-b' })];
    const result = filterBlastRadiusEntities(entities, {
      ownerId: null,
      schemaIds: ['schema-b'],
      viaSchemaIds: null
    });
    expect(result.map(e => e.entityId)).toEqual(['e2']);
  });

  it('filters by schema encountered along an intermediate hop, excluding the root and terminal', () => {
    const direct = entity({
      entityId: 'direct',
      paths: [
        {
          rootId: 'root',
          pathId: 'blast-radius',
          depth: 1,
          provenance: [hop('root', 'schema-root'), hop('direct', 'schema-a')]
        }
      ]
    });
    const viaB = entity({
      entityId: 'via-b',
      paths: [
        {
          rootId: 'root',
          pathId: 'blast-radius',
          depth: 2,
          provenance: [hop('root', 'schema-root'), hop('mid', 'schema-b'), hop('via-b', 'schema-a')]
        }
      ]
    });
    const result = filterBlastRadiusEntities([direct, viaB], {
      ownerId: null,
      schemaIds: null,
      viaSchemaIds: ['schema-b']
    });
    expect(result.map(e => e.entityId)).toEqual(['via-b']);
  });

  it('combines filters with AND semantics', () => {
    const entities = [
      entity({ entityId: 'match', ownerId: 'team-1', schemaId: 'schema-a' }),
      entity({ entityId: 'wrong-owner', ownerId: 'team-2', schemaId: 'schema-a' }),
      entity({ entityId: 'wrong-schema', ownerId: 'team-1', schemaId: 'schema-b' })
    ];
    const result = filterBlastRadiusEntities(entities, {
      ownerId: 'team-1',
      schemaIds: ['schema-a'],
      viaSchemaIds: null
    });
    expect(result.map(e => e.entityId)).toEqual(['match']);
  });
});

describe('viaSchemaIdsForEntity', () => {
  it('excludes the root and the terminal entity itself', () => {
    const e = entity({
      paths: [
        {
          rootId: 'root',
          pathId: 'blast-radius',
          depth: 2,
          provenance: [hop('root', 'schema-root'), hop('mid', 'schema-mid'), hop('e1', 'schema-a')]
        }
      ]
    });
    expect(viaSchemaIdsForEntity(e)).toEqual(['schema-mid']);
  });

  it('is empty for a direct (depth-1) path', () => {
    const e = entity();
    expect(viaSchemaIdsForEntity(e)).toEqual([]);
  });
});

describe('uniqueProvenanceHopIds', () => {
  it('deduplicates hop ids across entities and paths', () => {
    const shared = entity({
      entityId: 'e1',
      paths: [
        {
          rootId: 'root',
          pathId: 'blast-radius',
          depth: 1,
          provenance: [hop('root', 'schema-root'), hop('e1', 'schema-a')]
        }
      ]
    });
    const other = entity({
      entityId: 'e2',
      paths: [
        {
          rootId: 'root',
          pathId: 'blast-radius',
          depth: 1,
          provenance: [hop('root', 'schema-root'), hop('e2', 'schema-a')]
        }
      ]
    });
    expect(new Set(uniqueProvenanceHopIds([shared, other]))).toEqual(new Set(['root', 'e1', 'e2']));
  });
});
