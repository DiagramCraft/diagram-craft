import { describe, expect, it } from 'vitest';
import type { EntityTraversalResult } from './entityTraversal';
import {
  aggregateBatchEntityDependents,
  aggregateEntityTraversalResult
} from './entityTraversalAggregation';

const terminal = (
  id: string,
  schemaId: string,
  source: Record<string, unknown> = {},
  context: 'entity' | 'relation' = 'entity'
) => ({
  context,
  id,
  schemaId,
  source
});

const occurrence = (
  rootId: string,
  pathId: string,
  terminalId: string,
  schemaId: string,
  provenance: Array<{ context: 'entity' | 'relation'; id: string; schemaId: string }>,
  source: Record<string, unknown> = {},
  context: 'entity' | 'relation' = 'entity'
) => ({
  rootId,
  pathId,
  terminal: terminal(terminalId, schemaId, source, context),
  provenance
});

const emptyPath = (pathId: string) => ({
  pathId,
  occurrences: [],
  distinctTerminals: [],
  duplicateCount: 0,
  cycleDetected: false
});

describe('aggregateEntityTraversalResult', () => {
  it('deduplicates entities across roots and paths while retaining paths and ranking deterministically', () => {
    const result: EntityTraversalResult = {
      roots: [
        {
          rootId: 'root-a',
          paths: [
            {
              ...emptyPath('long'),
              occurrences: [
                occurrence(
                  'root-a',
                  'long',
                  'shared',
                  'service',
                  [
                    { context: 'entity', id: 'root-a', schemaId: 'root' },
                    { context: 'relation', id: 'relation-a', schemaId: 'connects' },
                    { context: 'entity', id: 'shared', schemaId: 'service' }
                  ],
                  {
                    _name: 'Shared service',
                    _slug: 'shared-service',
                    _owner: 'team-platform',
                    _lifecycle: 'active',
                    criticality: 3
                  }
                ),
                occurrence(
                  'root-a',
                  'long',
                  'high-criticality',
                  'service',
                  [
                    { context: 'entity', id: 'root-a', schemaId: 'root' },
                    { context: 'entity', id: 'middle', schemaId: 'service' },
                    { context: 'entity', id: 'other-middle', schemaId: 'service' },
                    { context: 'entity', id: 'high-criticality', schemaId: 'service' }
                  ],
                  { _name: 'High criticality', _lifecycle: 'active', criticality: 5 }
                )
              ]
            },
            {
              ...emptyPath('relation-terminal'),
              occurrences: [
                occurrence(
                  'root-a',
                  'relation-terminal',
                  'relation-result',
                  'connects',
                  [
                    { context: 'entity', id: 'root-a', schemaId: 'root' },
                    { context: 'relation', id: 'relation-result', schemaId: 'connects' }
                  ],
                  {},
                  'relation'
                )
              ]
            }
          ]
        },
        {
          rootId: 'root-b',
          paths: [
            {
              ...emptyPath('short'),
              occurrences: [
                occurrence(
                  'root-b',
                  'short',
                  'shared',
                  'service',
                  [
                    { context: 'entity', id: 'root-b', schemaId: 'root' },
                    { context: 'entity', id: 'shared', schemaId: 'service' }
                  ],
                  {
                    _name: 'Shared service',
                    _slug: 'shared-service',
                    _owner: 'team-platform',
                    _lifecycle: 'active',
                    criticality: 3
                  }
                )
              ]
            }
          ]
        }
      ]
    };

    const resultById = aggregateEntityTraversalResult(result, [
      { id: 'service', name: 'Service' },
      { id: 'root', name: 'Capability' }
    ]);

    expect(resultById.entities.map(entity => entity.entityId)).toEqual([
      'high-criticality',
      'shared'
    ]);
    expect(resultById.entities[1]).toMatchObject({
      entityName: 'Shared service',
      entitySlug: 'shared-service',
      schemaName: 'Service',
      ownerId: 'team-platform',
      lifecycleState: 'active',
      criticality: 3,
      depth: 1,
      paths: [
        { rootId: 'root-b', pathId: 'short', depth: 1 },
        { rootId: 'root-a', pathId: 'long', depth: 2 }
      ]
    });
    expect(resultById.groups.lifecycle).toMatchObject([
      { key: 'active', count: 2, highestCriticality: 5, shallowestDepth: 1 }
    ]);
    expect(resultById.groups.owner).toMatchObject([
      { key: null, count: 1, entityIds: ['high-criticality'] },
      { key: 'team-platform', count: 1, entityIds: ['shared'] }
    ]);
    expect(resultById.entities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: 'relation-result' })])
    );
  });

  it('adapts batch dependent results and counts each entity once across roots', () => {
    const dependent = {
      entityId: 'dependent',
      publicId: 'public-dependent',
      entitySlug: 'dependent',
      entityName: 'Dependent',
      entitySchemaId: 'service',
      schemaName: 'Service',
      ownerId: 'team-apps',
      lifecycleState: 'active',
      criticality: 4,
      fieldName: 'Uses',
      kind: 'reference' as const,
      depth: 1,
      viaPath: []
    };
    const results = new Map([
      ['root-a', { dependents: [dependent], truncated: false }],
      ['root-b', { dependents: [dependent], truncated: false }]
    ]);

    const aggregation = aggregateBatchEntityDependents(results);

    expect(aggregation.entities).toHaveLength(1);
    expect(aggregation.entities[0]).toMatchObject({
      entityId: 'dependent',
      criticality: 4,
      paths: [
        { rootId: 'root-a', depth: 1 },
        { rootId: 'root-b', depth: 1 }
      ]
    });
    expect(aggregation.groups.owner[0]).toMatchObject({ count: 1, entityIds: ['dependent'] });
  });
});
