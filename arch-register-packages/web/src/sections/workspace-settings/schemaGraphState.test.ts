import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { buildSchemaGraphData } from './schemaGraphState';

const schema = (id: string, fields: SchemaField[] = []): EntitySchema =>
  ({ id, name: id, fields, color: null, icon: null }) as EntitySchema;

const typedRelation = (
  id: string,
  relationSchemaId: string,
  direction: 'in' | 'out'
): SchemaField =>
  ({ id, name: id, type: 'typedRelation', relationSchemaId, direction }) as SchemaField;

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
        id: 'application::relation::rel-1::typed::rel-1::out',
        from: 'application',
        to: relationNodeId('rel-1'),
        label: 'out',
        kind: 'typed',
        relationId: 'rel-1'
      }),
      expect.objectContaining({
        id: 'relation::rel-1::service::typed::rel-1::in',
        from: relationNodeId('rel-1'),
        to: 'service',
        label: 'in',
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
          label: 'out'
        }),
        expect.objectContaining({
          from: relationNodeId('rel-1'),
          to: 'system',
          label: 'in'
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
    expect(typedEdges.filter(edge => edge.label === 'out').map(edge => edge.from)).toEqual([
      'application',
      'service',
      'team'
    ]);
    expect(typedEdges.filter(edge => edge.label === 'in').map(edge => edge.to)).toEqual([
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
      expect.objectContaining({ from: relationNodeId('rel-1'), to: 'service' })
    ]);
  });
});
