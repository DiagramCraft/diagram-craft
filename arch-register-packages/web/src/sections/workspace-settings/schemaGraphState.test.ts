import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { buildSchemaGraphEdges } from './schemaGraphState';

const schema = (id: string, fields: SchemaField[] = []): EntitySchema =>
  ({ id, name: id, fields }) as EntitySchema;

const typedRelation = (
  id: string,
  relationSchemaId: string,
  direction: 'in' | 'out'
): SchemaField =>
  ({ id, name: id, type: 'typedRelation', relationSchemaId, direction }) as SchemaField;

const relationSchema = (overrides: Partial<RelationSchema> = {}): RelationSchema =>
  ({
    id: 'rel-1',
    name: 'Uses',
    in: { schemaIds: ['service'] },
    out: { schemaIds: ['application'] },
    color: '#ff0000',
    ...overrides
  }) as RelationSchema;

describe('buildSchemaGraphEdges', () => {
  it('expands an outgoing typed relation to every allowed opposite endpoint', () => {
    const edges = buildSchemaGraphEdges(
      [
        schema('application', [typedRelation('uses', 'rel-1', 'out')]),
        schema('service'),
        schema('team')
      ],
      [relationSchema({ in: { schemaIds: ['service', 'team'] } })]
    );

    expect(edges).toEqual([
      expect.objectContaining({
        id: 'application::service::typed::rel-1::uses',
        from: 'application',
        to: 'service',
        label: 'Uses',
        kind: 'typed',
        color: '#ff0000',
        relationId: 'rel-1'
      }),
      expect.objectContaining({ from: 'application', to: 'team', kind: 'typed' })
    ]);
  });

  it('reverses the edge for an incoming typed relation field', () => {
    const edges = buildSchemaGraphEdges(
      [schema('service', [typedRelation('usedBy', 'rel-1', 'in')]), schema('application')],
      [relationSchema()]
    );

    expect(edges).toEqual([
      expect.objectContaining({ from: 'application', to: 'service', relationId: 'rel-1' })
    ]);
  });

  it('keeps typed edges distinct from generic edges and other typed fields', () => {
    const edges = buildSchemaGraphEdges(
      [
        schema('application', [
          {
            id: 'reference',
            name: 'service',
            type: 'reference',
            schemaId: 'service',
            minCount: 0,
            maxCount: -1
          } as SchemaField,
          typedRelation('uses-a', 'rel-1', 'out'),
          typedRelation('uses-b', 'rel-2', 'out')
        ]),
        schema('service')
      ],
      [relationSchema(), relationSchema({ id: 'rel-2', name: 'Depends on', color: null })]
    );

    expect(edges).toHaveLength(3);
    expect(new Set(edges.map(edge => edge.id)).size).toBe(3);
    expect(edges.map(edge => edge.kind)).toEqual(['reference', 'typed', 'typed']);
  });

  it('deduplicates repeated endpoint schema IDs and ignores missing targets', () => {
    const edges = buildSchemaGraphEdges(
      [schema('application', [typedRelation('uses', 'rel-1', 'out')]), schema('service')],
      [relationSchema({ in: { schemaIds: ['service', 'service', 'missing'] } })]
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual(expect.objectContaining({ to: 'service' }));
  });

  it('fans out a wildcard ("any") endpoint to every entity schema in the workspace', () => {
    const edges = buildSchemaGraphEdges(
      [
        schema('application', [typedRelation('uses', 'rel-1', 'out')]),
        schema('service'),
        schema('team')
      ],
      [relationSchema({ in: { schemaIds: 'any' } })]
    );

    expect(edges).toHaveLength(3);
    expect(new Set(edges.map(edge => edge.to))).toEqual(
      new Set(['service', 'team', 'application'])
    );
  });
});
