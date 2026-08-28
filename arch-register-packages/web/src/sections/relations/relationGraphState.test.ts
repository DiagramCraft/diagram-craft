import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import {
  buildRelationGraphData,
  getRelationGraphEdgeColor,
  getRelationGraphEdgeLabel
} from './relationGraphState';

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

const dataFlowSchema = {
  id: 'flow',
  name: 'Data flow',
  fields: [
    {
      id: 'data_entities',
      name: 'Data',
      type: 'entityRelation',
      predicate: 'carries',
      schemaId: 'data-entity',
      minCount: 0,
      maxCount: -1
    }
  ]
} as never;

describe('buildRelationGraphData (flat mode, default)', () => {
  it('builds the union of endpoint nodes and one directed edge per relation instance', () => {
    const result = buildRelationGraphData([
      relation(),
      relation({
        _uid: 'relation-2',
        _out: { id: 'c', name: 'C', schemaId: 'queue' }
      })
    ]);

    expect(result.nodes).toEqual([
      {
        id: 'a',
        data: { kind: 'entity', entityId: 'a', entityName: 'A', entitySchemaId: 'service' }
      },
      {
        id: 'b',
        data: { kind: 'entity', entityId: 'b', entityName: 'B', entitySchemaId: 'database' }
      },
      { id: 'c', data: { kind: 'entity', entityId: 'c', entityName: 'C', entitySchemaId: 'queue' } }
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

  it('hashes selected field values to stable palette colors', () => {
    const first = getRelationGraphEdgeColor(relation({ status: 'Active' }), undefined, 'status');
    const second = getRelationGraphEdgeColor(
      relation({ _uid: 'relation-2', status: 'Active' }),
      undefined,
      'status'
    );
    const other = getRelationGraphEdgeColor(relation({ status: 'Inactive' }), undefined, 'status');

    expect(first).toBe(second);
    expect(first).not.toBe(other);
  });
});

// #3066: 'entity' mode renders each relation instance as its own node (mirroring how the
// workspace model-overview graph renders relation *schemas* as boxes), with "in"/"out" fan edges
// to its endpoints, plus one fan edge per entityRelation field to whatever entities it
// references — e.g. a Data Flow relation's carried Data Entities.
describe('buildRelationGraphData (entity mode)', () => {
  it('renders the relation instance as its own node with in/out fan edges to its endpoints', () => {
    const result = buildRelationGraphData(
      [relation()],
      [dataFlowSchema],
      undefined,
      undefined,
      new Map(),
      'entity'
    );

    expect(result.nodes).toContainEqual({
      id: 'relation::relation-1',
      data: {
        kind: 'relation',
        relationId: 'relation-1',
        relationSchemaId: 'flow',
        relationName: 'Data flow'
      }
    });
    expect(result.edges).toContainEqual(
      expect.objectContaining({ from: 'a', to: 'relation::relation-1', label: 'in' })
    );
    expect(result.edges).toContainEqual(
      expect.objectContaining({ from: 'relation::relation-1', to: 'b', label: 'out' })
    );
  });

  it('adds a node and a fan edge per resolved entityRelation-field target', () => {
    const result = buildRelationGraphData(
      [relation({ data_entities: ['de-1', 'de-2'] })],
      [dataFlowSchema],
      undefined,
      undefined,
      new Map(),
      'entity',
      new Map([
        ['de-1', { name: 'Customer Credentials', schemaId: 'data-entity' }],
        ['de-2', { name: 'Order Records', schemaId: 'data-entity' }]
      ])
    );

    expect(result.nodes).toContainEqual({
      id: 'de-1',
      data: {
        kind: 'entity',
        entityId: 'de-1',
        entityName: 'Customer Credentials',
        entitySchemaId: 'data-entity'
      }
    });
    expect(result.nodes).toContainEqual({
      id: 'de-2',
      data: {
        kind: 'entity',
        entityId: 'de-2',
        entityName: 'Order Records',
        entitySchemaId: 'data-entity'
      }
    });
    const fieldEdges = result.edges.filter(
      edge => edge.from === 'relation::relation-1' && edge.to !== 'b'
    );
    expect(fieldEdges).toHaveLength(2);
    expect(fieldEdges).toContainEqual(
      expect.objectContaining({ from: 'relation::relation-1', to: 'de-1', label: 'carries' })
    );
  });

  it('omits an entityRelation-field id the lookup could not resolve, rather than a blank node', () => {
    const result = buildRelationGraphData(
      [relation({ data_entities: ['de-1', 'de-restricted'] })],
      [dataFlowSchema],
      undefined,
      undefined,
      new Map(),
      'entity',
      new Map([['de-1', { name: 'Customer Credentials', schemaId: 'data-entity' }]])
    );

    expect(result.nodes.map(node => node.id)).not.toContain('de-restricted');
    expect(result.edges.filter(edge => edge.to === 'de-restricted')).toHaveLength(0);
  });

  it('does not render relation nodes/fan edges when mode is flat (the default)', () => {
    const result = buildRelationGraphData(
      [relation({ data_entities: ['de-1'] })],
      [dataFlowSchema]
    );
    expect(result.nodes.every(node => node.data.kind !== 'relation')).toBe(true);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });
});
