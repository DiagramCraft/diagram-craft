import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import {
  buildSchemaGraphData,
  parseCategoryStatesParam,
  serializeCategoryStatesParam,
  type EntityCategoryStates
} from './schemaGraphState';
import { UNCATEGORIZED_SCHEMA_CATEGORY } from '../../lib/schemaPresentation';

const schema = (
  id: string,
  fields: SchemaField[] = [],
  category: string | null = null
): EntitySchema => ({ id, name: id, fields, color: null, icon: null, category }) as EntitySchema;

const reference = (
  id: string,
  schemaId: string,
  type: 'reference' | 'containment' = 'reference'
): SchemaField =>
  ({
    id,
    name: id,
    type,
    schemaId,
    minCount: 0,
    maxCount: type === 'containment' ? 1 : -1
  }) as SchemaField;

const typedRelation = (
  id: string,
  relationSchemaId: string,
  direction: 'in' | 'out'
): SchemaField =>
  ({
    id,
    name: id,
    type: 'typedRelation',
    relationSchemaId,
    direction,
    minCount: 0,
    maxCount: -1
  }) as SchemaField;

const entityRelation = (
  id: string,
  schemaId: string,
  predicate?: string
): RelationSchema['fields'][number] =>
  ({
    id,
    name: id,
    type: 'entityRelation',
    ...(predicate ? { predicate } : {}),
    schemaId,
    minCount: 0,
    maxCount: -1
  }) as RelationSchema['fields'][number];

const relationSchema = (overrides: Partial<RelationSchema> = {}): RelationSchema =>
  ({
    id: 'rel-1',
    name: 'Uses',
    in: { schemaIds: ['service'] },
    out: { schemaIds: ['application'] },
    fields: [],
    color: '#ff0000',
    icon: 'network',
    ...overrides
  }) as RelationSchema;

const relationNodeId = (id: string): string => `relation::${id}`;

describe('buildSchemaGraphData', () => {
  it('creates one relation node and deduplicates endpoint bindings', () => {
    const result = buildSchemaGraphData(
      [
        schema('application', [typedRelation('uses', 'rel-1', 'out')]),
        schema('service', [typedRelation('usedBy', 'rel-1', 'in')])
      ],
      [relationSchema()]
    );

    expect(result.nodes.map(node => node.id)).toEqual([
      'application',
      'service',
      relationNodeId('rel-1')
    ]);
    expect(result.edges).toEqual([
      expect.objectContaining({
        id: 'service::relation::rel-1::typed::rel-1::in',
        from: 'service',
        to: relationNodeId('rel-1'),
        label: 'in',
        kind: 'typed',
        relationId: 'rel-1'
      }),
      expect.objectContaining({
        id: 'relation::rel-1::application::typed::rel-1::out',
        from: relationNodeId('rel-1'),
        to: 'application',
        label: 'out',
        kind: 'typed',
        relationId: 'rel-1'
      })
    ]);
  });

  it('represents relation-owned entity fields as edges from the relation node', () => {
    const result = buildSchemaGraphData(
      [schema('system'), schema('data-entity')],
      [
        relationSchema({
          name: 'Data Flow',
          in: { schemaIds: ['system'] },
          out: { schemaIds: ['system'] },
          fields: [entityRelation('data_entities', 'data-entity', 'carries')]
        })
      ]
    );

    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: relationNodeId('rel-1'),
        data: expect.objectContaining({ kind: 'relation' })
      })
    );
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'system',
          to: relationNodeId('rel-1'),
          label: 'in'
        }),
        expect.objectContaining({
          from: relationNodeId('rel-1'),
          to: 'system',
          label: 'out'
        }),
        expect.objectContaining({
          from: relationNodeId('rel-1'),
          to: 'data-entity',
          label: 'carries',
          relationId: 'rel-1'
        })
      ])
    );
  });

  it('fans out wildcard endpoints, deduplicates repeated schemas, and ignores missing targets', () => {
    const result = buildSchemaGraphData(
      [schema('application'), schema('service'), schema('team')],
      [
        relationSchema({
          in: { schemaIds: ['service', 'service', 'missing'] },
          out: { schemaIds: 'any' }
        })
      ]
    );

    const typedEdges = result.edges.filter(edge => edge.kind === 'typed');
    expect(typedEdges).toHaveLength(4);
    expect(typedEdges.filter(edge => edge.label === 'out').map(edge => edge.to)).toEqual([
      'application',
      'service',
      'team'
    ]);
    expect(typedEdges.filter(edge => edge.label === 'in').map(edge => edge.from)).toEqual([
      'service'
    ]);
  });

  it('preserves generic reference and containment edges', () => {
    const result = buildSchemaGraphData(
      [
        schema('application', [
          {
            id: 'depends-on',
            name: 'Depends on',
            type: 'reference',
            schemaId: 'service',
            minCount: 0,
            maxCount: -1
          } as SchemaField,
          {
            id: 'owned-service',
            name: 'Owned service',
            type: 'containment',
            schemaId: 'service',
            minCount: 0,
            maxCount: 1
          } as SchemaField
        ]),
        schema('service')
      ],
      []
    );

    expect(result.edges).toEqual([
      {
        id: 'application::service',
        from: 'application',
        to: 'service',
        label: 'Depends on, Owned service',
        kind: 'containment'
      }
    ]);
  });

  it('shows relation schemas even when no entity schema has a typedRelation binding', () => {
    const result = buildSchemaGraphData([schema('service')], [relationSchema()]);

    expect(result.nodes.map(node => node.id)).toContain(relationNodeId('rel-1'));
    expect(result.edges).toEqual([
      expect.objectContaining({ from: 'service', to: relationNodeId('rel-1') })
    ]);
  });

  it('is unaffected when no categoryStates are provided (regression guard)', () => {
    const withoutArg = buildSchemaGraphData(
      [schema('application'), schema('service')],
      [relationSchema()]
    );
    const withEmptyMap = buildSchemaGraphData(
      [schema('application'), schema('service')],
      [relationSchema()],
      new Map()
    );

    expect(withEmptyMap).toEqual(withoutArg);
  });

  describe('category states', () => {
    it('collapses a category into a single box node with a member count', () => {
      const result = buildSchemaGraphData(
        [schema('svc-a', [], 'Services'), schema('svc-b', [], 'Services'), schema('team')],
        [],
        new Map([['Services', 'collapsed']])
      );

      expect(result.nodes.map(node => node.id)).toEqual(['team', 'category::Services']);
      expect(result.nodes).toContainEqual({
        id: 'category::Services',
        data: { kind: 'category', category: 'Services', count: 2 }
      });
    });

    it('dedupes generic edges from multiple collapsed members into the same box', () => {
      const result = buildSchemaGraphData(
        [
          schema('svc-a', [reference('depends-on', 'shared')], 'Services'),
          schema('svc-b', [reference('depends-on', 'shared')], 'Services'),
          schema('shared')
        ],
        [],
        new Map([['Services', 'collapsed']])
      );

      const genericEdges = result.edges.filter(edge => edge.kind !== 'typed');
      expect(genericEdges).toEqual([
        expect.objectContaining({ from: 'category::Services', to: 'shared' })
      ]);
    });

    it('degrades a typed relation to a direct deduped edge once an endpoint is collapsed', () => {
      const result = buildSchemaGraphData(
        [schema('svc-a', [], 'Services'), schema('svc-b', [], 'Services'), schema('application')],
        [
          relationSchema({
            out: { schemaIds: ['svc-a', 'svc-b'] },
            in: { schemaIds: ['application'] }
          })
        ],
        new Map([['Services', 'collapsed']])
      );

      // No more dedicated relation node/fan-out — a single direct edge into the box (the "in"
      // side points into the relation, "out" points out of it), labeled with the relation name
      // instead of 'out'/'in'.
      expect(result.nodes.map(node => node.id)).toEqual(['application', 'category::Services']);
      expect(result.edges).toEqual([
        expect.objectContaining({
          from: 'application',
          to: 'category::Services',
          label: 'Uses',
          relationId: 'rel-1'
        })
      ]);
    });

    it('keeps the dedicated relation node when none of its endpoints are collapsed or hidden', () => {
      const result = buildSchemaGraphData(
        [schema('application'), schema('service'), schema('team', [], 'Services')],
        [relationSchema({ out: { schemaIds: ['application'] }, in: { schemaIds: ['service'] } })],
        new Map([['Services', 'collapsed']])
      );

      expect(result.nodes.map(node => node.id)).toContain(relationNodeId('rel-1'));
      expect(result.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: 'service', to: relationNodeId('rel-1'), label: 'in' }),
          expect.objectContaining({
            from: relationNodeId('rel-1'),
            to: 'application',
            label: 'out'
          })
        ])
      );
    });

    it('drops the edge when both endpoints collapse into the same category box', () => {
      const result = buildSchemaGraphData(
        [
          schema('svc-a', [reference('peer', 'svc-b')], 'Services'),
          schema('svc-b', [], 'Services')
        ],
        [],
        new Map([['Services', 'collapsed']])
      );

      expect(result.edges).toEqual([]);
    });

    it('hides a category entirely, dropping the entity and any touching edges', () => {
      const result = buildSchemaGraphData(
        [
          schema('application', [reference('depends-on', 'svc-a')]),
          schema('svc-a', [], 'Services'),
          schema('team')
        ],
        [
          relationSchema({
            out: { schemaIds: ['svc-a'] },
            in: { schemaIds: ['application', 'team'] }
          })
        ],
        new Map([['Services', 'hidden']])
      );

      // The relation degrades (an endpoint is hidden) but the hidden side contributes no
      // resolvable id, so no direct edge can be drawn either — the relation disappears entirely,
      // same as any other edge touching a hidden entity.
      expect(result.nodes.map(node => node.id)).toEqual(['application', 'team']);
      expect(result.edges).toEqual([]);
    });

    it('resolves and dedupes entityRelation field edges through collapsed categories', () => {
      const result = buildSchemaGraphData(
        [schema('system'), schema('data-a', [], 'Data'), schema('data-b', [], 'Data')],
        [
          relationSchema({
            in: { schemaIds: ['system'] },
            out: { schemaIds: ['system'] },
            fields: [
              entityRelation('carries-a', 'data-a', 'carries'),
              entityRelation('carries-b', 'data-b', 'carries')
            ]
          })
        ],
        new Map([['Data', 'collapsed']])
      );

      const carriesEdges = result.edges.filter(edge => edge.label === 'carries');
      expect(carriesEdges).toEqual([
        expect.objectContaining({ from: relationNodeId('rel-1'), to: 'category::Data' })
      ]);
    });

    it('buckets uncategorized entities using the shared normalization', () => {
      const result = buildSchemaGraphData(
        [schema('svc-a', [], null), schema('svc-b', [], '  ')],
        [],
        new Map([[UNCATEGORIZED_SCHEMA_CATEGORY, 'collapsed']])
      );

      expect(result.nodes).toEqual([
        {
          id: `category::${UNCATEGORIZED_SCHEMA_CATEGORY}`,
          data: { kind: 'category', category: UNCATEGORIZED_SCHEMA_CATEGORY, count: 2 }
        }
      ]);
    });
  });

  describe('typedRelationMode', () => {
    it('defaults to entity mode, unaffected when the argument is omitted', () => {
      const result = buildSchemaGraphData(
        [schema('application'), schema('service')],
        [relationSchema()]
      );

      expect(result.nodes.map(node => node.id)).toContain(relationNodeId('rel-1'));
    });

    it('renders every typed relation as a direct edge in reference mode, even with no collapsed categories', () => {
      const result = buildSchemaGraphData(
        [schema('application'), schema('service')],
        [relationSchema()],
        new Map(),
        'reference'
      );

      expect(result.nodes.map(node => node.id)).toEqual(['application', 'service']);
      expect(result.edges).toEqual([
        expect.objectContaining({ from: 'service', to: 'application', label: 'Uses' })
      ]);
    });

    it('dedupes reference-mode edges from wildcard endpoints', () => {
      const result = buildSchemaGraphData(
        [schema('application'), schema('service'), schema('team')],
        [relationSchema({ in: { schemaIds: ['service'] }, out: { schemaIds: 'any' } })],
        new Map(),
        'reference'
      );

      expect(result.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: 'service', to: 'application' }),
          expect.objectContaining({ from: 'service', to: 'team' })
        ])
      );
      expect(result.edges).toHaveLength(2);
    });
  });
});

describe('parseCategoryStatesParam / serializeCategoryStatesParam', () => {
  it('returns an empty map for undefined or malformed input', () => {
    expect(parseCategoryStatesParam(undefined)).toEqual(new Map());
    expect(parseCategoryStatesParam('not json')).toEqual(new Map());
    expect(parseCategoryStatesParam('null')).toEqual(new Map());
    expect(parseCategoryStatesParam('[]')).toEqual(new Map());
  });

  it('filters out invalid state values', () => {
    expect(
      parseCategoryStatesParam(JSON.stringify({ Services: 'collapsed', Data: 'foo' }))
    ).toEqual(new Map([['Services', 'collapsed']]));
  });

  it('never serializes visible (absent) entries and round-trips collapsed/hidden ones', () => {
    const states: EntityCategoryStates = new Map([
      ['Services', 'collapsed'],
      ['Data', 'hidden']
    ]);

    const serialized = serializeCategoryStatesParam(states);
    expect(serialized).toBeDefined();
    expect(parseCategoryStatesParam(serialized)).toEqual(states);

    expect(serializeCategoryStatesParam(new Map())).toBeUndefined();
  });
});
