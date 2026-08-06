import { describe, expect, it } from 'vitest';
import type { EntityRelationData } from '../../../hooks/useEntities';
import {
  buildEntityGraphData,
  collectEntityGraphIds,
  type EntityGraphDirection
} from './entityGraphState';

const relation = (entityId: string, fieldName = 'dependsOn') => ({
  entityId,
  publicId: entityId.toUpperCase(),
  entitySlug: entityId,
  entityName: entityId,
  entitySchemaId: 'service',
  fieldName,
  kind: 'reference' as const
});

const typedRelation = (
  entityId: string,
  relationId: string,
  overrides: {
    fieldName?: string;
    relationSchemaColor?: string | null;
    relationSchemaId?: string;
  } = {}
) => ({
  entityId,
  publicId: entityId.toUpperCase(),
  entitySlug: entityId,
  entityName: entityId,
  entitySchemaId: 'service',
  fieldName: overrides.fieldName ?? 'dataFlow',
  kind: 'typed' as const,
  relationId,
  relationSchemaId: overrides.relationSchemaId ?? 'flow-schema',
  relationSchemaColor: overrides.relationSchemaColor ?? '#ff0000'
});

const data = (value: Partial<EntityRelationData> = {}): EntityRelationData => ({
  outgoing: value.outgoing ?? [],
  incoming: value.incoming ?? [],
  isLoading: value.isLoading ?? false
});

const options = (
  relationsData: Map<string, EntityRelationData>,
  overrides: Partial<Parameters<typeof collectEntityGraphIds>[0]> = {}
) => ({
  rootEntityId: 'root',
  relationsData,
  maxDepth: 1,
  excludedIds: new Set<string>(),
  manuallyExpanded: new Set<string>(),
  ...overrides
});

describe('collectEntityGraphIds', () => {
  it('traverses both directions up to the configured depth and handles cycles', () => {
    const relations = new Map([
      ['root', data({ outgoing: [relation('child')], incoming: [relation('parent')] })],
      ['child', data({ outgoing: [relation('grandchild')] })],
      ['parent', data({ incoming: [relation('root')] })],
      ['grandchild', data()],
      ['root-again', data()]
    ]);

    expect(collectEntityGraphIds(options(relations))).toEqual(['root', 'child', 'parent']);
  });

  it('includes manually expanded nodes beyond max depth and excludes hidden IDs', () => {
    const relations = new Map([
      ['root', data({ outgoing: [relation('child'), relation('excluded')] })],
      ['child', data({ outgoing: [relation('grandchild')] })],
      ['grandchild', data()],
      ['excluded', data()]
    ]);

    expect(
      collectEntityGraphIds(
        options(relations, {
          excludedIds: new Set(['excluded']),
          manuallyExpanded: new Set(['child'])
        })
      )
    ).toEqual(['root', 'child', 'grandchild']);
  });

  it.each([
    ['upstream', ['root', 'dependency']],
    ['downstream', ['root', 'dependent']],
    ['both', ['root', 'dependency', 'dependent']]
  ] as const)('%s follows only its selected relation direction', (direction, expected) => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [relation('dependency')],
          incoming: [relation('dependent')]
        })
      ],
      ['dependency', data()],
      ['dependent', data()]
    ]);

    expect(
      collectEntityGraphIds(options(relations, { direction: direction as EntityGraphDirection }))
    ).toEqual(expected);
  });

  it('only traverses relations matching the relation schema filter', () => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [
            typedRelation('flow-target', 'rel-1', { relationSchemaId: 'flow-schema' }),
            typedRelation('other-target', 'rel-2', { relationSchemaId: 'other-schema' }),
            relation('generic-target')
          ]
        })
      ],
      ['flow-target', data()],
      ['other-target', data()],
      ['generic-target', data()]
    ]);

    expect(
      collectEntityGraphIds(
        options(relations, { relationSchemaIds: new Set(['flow-schema']) })
      )
    ).toEqual(['root', 'flow-target']);
  });

  it('stops traversal at max depth while still exposing relations on the boundary node', () => {
    const relations = new Map([
      ['root', data({ outgoing: [relation('child')] })],
      ['child', data({ outgoing: [relation('grandchild')] })],
      ['grandchild', data()]
    ]);

    const result = buildEntityGraphData({
      ...options(relations),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.nodes.map(node => node.id)).toEqual(['root', 'child']);
    expect(result.hiddenCountMap.get('child')).toBe(1);
  });
});

describe('buildEntityGraphData', () => {
  it('deduplicates edges and counts relations outside the visible graph', () => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [relation('child'), relation('child'), relation('hidden')],
          incoming: [relation('incoming-hidden')]
        })
      ],
      ['child', data({ incoming: [relation('root')] })],
      ['hidden', data()],
      ['incoming-hidden', data()]
    ]);

    const result = buildEntityGraphData({
      ...options(relations),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application',
      excludedIds: new Set(['hidden', 'incoming-hidden'])
    });

    expect(result.nodes.map(node => node.id)).toEqual(['root', 'child']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'root::child::dependsOn',
      from: 'root',
      to: 'child',
      label: 'dependsOn'
    });
    expect(result.hiddenCountMap.get('root')).toBe(2);
  });

  it('keeps loading nodes visible without expanding them', () => {
    const result = buildEntityGraphData({
      ...options(new Map([['root', data({ isLoading: true })]])),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
    expect(result.hiddenCountMap.get('root')).toBe(0);
  });

  it('orients downstream and bidirectional edges from the dependent to its dependency', () => {
    const relations = new Map([
      ['root', data({ incoming: [relation('dependent', 'uses')] })],
      ['dependent', data({ outgoing: [relation('root', 'uses')] })]
    ]);

    const result = buildEntityGraphData({
      ...options(relations, { direction: 'downstream' }),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.edges).toEqual([
      expect.objectContaining({
        id: 'dependent::root::uses',
        from: 'dependent',
        to: 'root'
      })
    ]);
  });

  it('keeps distinct typed relation instances of the same relation schema as separate edges', () => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [
            typedRelation('child', 'rel-1'),
            typedRelation('child', 'rel-2'),
            typedRelation('child', 'rel-1') // duplicate fetch/render of the same instance
          ]
        })
      ],
      ['child', data()]
    ]);

    const result = buildEntityGraphData({
      ...options(relations),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.edges).toHaveLength(2);
    expect(result.edges.map(e => e.id).sort()).toEqual([
      'root::child::typed::rel-1',
      'root::child::typed::rel-2'
    ]);
    expect(result.edges[0]).toMatchObject({ kind: 'typed', color: '#ff0000', relationId: 'rel-1' });
  });

  it('hides generic and non-matching typed relations when a relation schema filter is set', () => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [
            typedRelation('flow-target', 'rel-1', { relationSchemaId: 'flow-schema' }),
            typedRelation('other-target', 'rel-2', { relationSchemaId: 'other-schema' }),
            relation('generic-target')
          ]
        })
      ],
      ['flow-target', data()],
      ['other-target', data()],
      ['generic-target', data()]
    ]);

    const result = buildEntityGraphData({
      ...options(relations, { relationSchemaIds: new Set(['flow-schema']) }),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.nodes.map(node => node.id)).toEqual(['root', 'flow-target']);
    expect(result.edges).toEqual([
      expect.objectContaining({ id: 'root::flow-target::typed::rel-1', kind: 'typed' })
    ]);
  });

  it('does not collapse a typed relation with a generic relation between the same pair', () => {
    const relations = new Map([
      [
        'root',
        data({
          outgoing: [relation('child', 'dataFlow'), typedRelation('child', 'rel-1')]
        })
      ],
      ['child', data()]
    ]);

    const result = buildEntityGraphData({
      ...options(relations),
      rootEntityName: 'Root',
      rootEntitySchemaId: 'application'
    });

    expect(result.edges).toHaveLength(2);
    expect(result.edges.map(e => e.kind).sort()).toEqual(['reference', 'typed']);
  });
});
