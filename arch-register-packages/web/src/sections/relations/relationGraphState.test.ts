import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { buildRelationGraphData, getRelationGraphEdgeLabel } from './relationGraphState';

const relation = (overrides: Partial<RelationRecord> = {}): RelationRecord => ({
  _uid: 'relation-1',
  _schema: { id: 'flow', name: 'Data flow' },
  _in: { id: 'a', name: 'A', schemaId: 'service' },
  _out: { id: 'b', name: 'B', schemaId: 'database' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00.000Z',
  _updatedAt: '2026-01-01T00:00:00.000Z',
  canView: true,
  canEdit: true,
  canDelete: true,
  canAdmin: false,
  ...overrides
});

describe('buildRelationGraphData', () => {
  it('builds the union of endpoint nodes and one directed edge per relation instance', () => {
    const result = buildRelationGraphData([
      relation(),
      relation({
        _uid: 'relation-2',
        _out: { id: 'c', name: 'C', schemaId: 'queue' }
      })
    ]);

    expect(result.nodes).toEqual([
      { id: 'a', data: { entityId: 'a', entityName: 'A', entitySchemaId: 'service' } },
      { id: 'b', data: { entityId: 'b', entityName: 'B', entitySchemaId: 'database' } },
      { id: 'c', data: { entityId: 'c', entityName: 'C', entitySchemaId: 'queue' } }
    ]);
    expect(result.edges).toEqual([
      expect.objectContaining({
        id: 'relation-1',
        from: 'a',
        to: 'b',
        label: 'Data flow',
        relationId: 'relation-1'
      }),
      expect.objectContaining({ id: 'relation-2', from: 'a', to: 'c' })
    ]);
  });

  it('preserves parallel relations and self-loops', () => {
    const result = buildRelationGraphData(
      [
        relation(),
        relation({ _uid: 'relation-2' }),
        relation({
          _uid: 'relation-3',
          _in: { id: 'b', name: 'B', schemaId: 'database' },
          _out: { id: 'b', name: 'B', schemaId: 'database' }
        })
      ],
      [{ id: 'flow', name: 'Data flow', color: '#ff0000' } as never]
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(3);
    expect(result.edges[0]).toMatchObject({ kind: 'typed', color: '#ff0000' });
    expect(result.edges[2]).toMatchObject({ from: 'b', to: 'b' });
  });

  it('uses a selected relation field as the edge label and falls back to the type', () => {
    const result = buildRelationGraphData(
      [relation({ status: 'Active' }), relation({ _uid: 'relation-2' })],
      [],
      'status'
    );

    expect(result.edges.map(edge => edge.label)).toEqual(['Active', 'Data flow']);
    expect(getRelationGraphEdgeLabel(relation({ count: 3 }), 'count')).toBe('3');
  });

  it('uses entity names for selected reference fields', () => {
    expect(
      getRelationGraphEdgeLabel(
        relation({ related: ['entity-1', 'entity-2'] }),
        'related',
        new Map([
          ['entity-1', { name: 'Address' }],
          ['entity-2', { name: 'Order' }]
        ])
      )
    ).toBe('Address, Order');
  });
});
