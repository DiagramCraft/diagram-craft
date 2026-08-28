import { describe, expect, it } from 'vitest';
import {
  buildRelationQueryFromFilters,
  buildRelationSavedViewPayload,
  endpointFieldId,
  filterConditionsFromRelationQuery,
  getRelationGraphLabelOptions,
  isRelationBasicRepresentable,
  parseEndpointFieldId,
  RELATION_GRAPH_TYPE_LABEL,
  resolveSingleSchemaFilter,
  toSavedRelationViewSearch
} from './relationBrowserState';

describe('buildRelationQueryFromFilters', () => {
  it('builds a schema-less, empty AND node for no conditions', () => {
    const query = buildRelationQueryFromFilters([]);
    expect(query).toEqual({
      root_kind: 'relation',
      root: { kind: 'and', children: [] }
    });
  });

  it('compiles an own-field condition to a root-level predicate', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: 'status', op: 'equals', value: 'active' }
    ]);
    expect(query.root).toEqual({
      kind: 'and',
      children: [{ kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }]
    });
  });

  it('compiles a Type (_schemaId) condition like any other own-field predicate', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: '_schemaId', op: 'equals', value: 'rel-schema-1' }
    ]);
    expect(query.root).toEqual({
      kind: 'and',
      children: [
        { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: 'rel-schema-1' }
      ]
    });
  });

  it('compiles an in: prefixed condition to an endpoint predicate', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: endpointFieldId('in', 'name'), op: 'contains', value: 'System' }
    ]);
    expect(query.root).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'predicate',
          path: [{ kind: 'endpoint', direction: 'in' }],
          fieldId: 'name',
          op: 'contains',
          value: 'System'
        }
      ]
    });
  });

  it('compiles an out: prefixed condition to an endpoint predicate', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: endpointFieldId('out', 'owner'), op: 'equals', value: 'team-1' }
    ]);
    expect(query.root).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'predicate',
          path: [{ kind: 'endpoint', direction: 'out' }],
          fieldId: 'owner',
          op: 'equals',
          value: 'team-1'
        }
      ]
    });
  });

  it('mixes own-field and endpoint conditions', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: 'status', op: 'equals', value: 'active' },
      { fieldId: endpointFieldId('in', 'name'), op: 'contains', value: 'System' }
    ]);
    expect(query.root.kind).toBe('and');
    expect((query.root as { children: unknown[] }).children).toHaveLength(2);
  });
});

describe('parseEndpointFieldId', () => {
  it('parses in:/out: prefixed field ids', () => {
    expect(parseEndpointFieldId('in:name')).toEqual({ direction: 'in', fieldId: 'name' });
    expect(parseEndpointFieldId('out:owner')).toEqual({ direction: 'out', fieldId: 'owner' });
  });

  it('returns null for an unprefixed field id', () => {
    expect(parseEndpointFieldId('status')).toBeNull();
  });
});

describe('resolveSingleSchemaFilter', () => {
  it('returns null when there is no Type condition', () => {
    expect(resolveSingleSchemaFilter([])).toBeNull();
    expect(
      resolveSingleSchemaFilter([{ fieldId: 'status', op: 'equals', value: 'active' }])
    ).toBeNull();
  });

  it('resolves the schema id from a single _schemaId equals condition', () => {
    const conditions = [{ fieldId: '_schemaId', op: 'equals' as const, value: 'rel-schema-1' }];
    expect(resolveSingleSchemaFilter(conditions)).toBe('rel-schema-1');
  });

  it('returns null for a _schemaId not_equals condition', () => {
    const conditions = [{ fieldId: '_schemaId', op: 'not_equals' as const, value: 'rel-schema-1' }];
    expect(resolveSingleSchemaFilter(conditions)).toBeNull();
  });

  it('returns null when more than one _schemaId equals condition is present', () => {
    const conditions = [
      { fieldId: '_schemaId', op: 'equals' as const, value: 'rel-schema-1' },
      { fieldId: '_schemaId', op: 'equals' as const, value: 'rel-schema-2' }
    ];
    expect(resolveSingleSchemaFilter(conditions)).toBeNull();
  });

  it('ignores unrelated conditions when resolving the Type filter', () => {
    const conditions = [
      { fieldId: 'status', op: 'equals' as const, value: 'active' },
      { fieldId: '_schemaId', op: 'equals' as const, value: 'rel-schema-1' }
    ];
    expect(resolveSingleSchemaFilter(conditions)).toBe('rel-schema-1');
  });
});

describe('relation saved view display mode', () => {
  it('restores Graph mode from a saved relation view', () => {
    expect(
      toSavedRelationViewSearch({
        id: 'view-1',
        viewMode: 'graph',
        filters: buildRelationQueryFromFilters([])
      } as never)
    ).toMatchObject({ viewId: 'view-1', viewMode: 'graph' });
  });

  it('restores the selected graph edge label from a saved relation view', () => {
    expect(
      toSavedRelationViewSearch({
        id: 'view-1',
        viewMode: 'graph',
        filters: buildRelationQueryFromFilters([]),
        config: { graph: { edgeLabelFieldId: 'status', edgeColorFieldId: 'priority' } }
      } as never)
    ).toMatchObject({ viewId: 'view-1', edgeLabelFieldId: 'status', edgeColorFieldId: 'priority' });
  });

  it('persists graph edge label configuration and exposes relation fields as options', () => {
    expect(
      buildRelationSavedViewPayload({
        name: 'Graph',
        description: '',
        isAdminView: false,
        viewMode: 'graph',
        conditions: [],
        edgeLabelFieldId: 'status',
        edgeColorFieldId: 'priority'
      }).config
    ).toEqual({ graph: { edgeLabelFieldId: 'status', edgeColorFieldId: 'priority' } });

    expect(
      getRelationGraphLabelOptions([
        { id: 'flow', name: 'Flow', fields: [{ id: 'status', name: 'Status' }] }
      ] as never)
    ).toEqual([
      { value: RELATION_GRAPH_TYPE_LABEL, label: 'Relation type' },
      { value: 'status', label: 'Status' }
    ]);
  });
});

// #3066: saved views built around OR-grouping or a relationForward traversal (e.g. "restricted
// data flows" combining the flow's own classification with a carried entity's) used to be
// silently flattened/dropped by the Basic-mode round-trip below. isRelationBasicRepresentable
// detects that case so callers can keep the raw query and open in Advanced (text) mode instead.
describe('isRelationBasicRepresentable', () => {
  it('is representable for a flat AND of own-field and endpoint predicates', () => {
    const query = buildRelationQueryFromFilters([
      { fieldId: '_schemaId', op: 'equals', value: 'data-flow' },
      { fieldId: 'in:status', op: 'equals', value: 'active' }
    ]);
    expect(isRelationBasicRepresentable(query)).toBe(true);
  });

  it('is representable for a single top-level predicate root (not wrapped in and)', () => {
    expect(
      isRelationBasicRepresentable({
        root_kind: 'relation',
        root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
      })
    ).toBe(true);
  });

  it('is not representable when the root contains an or node', () => {
    expect(
      isRelationBasicRepresentable({
        root_kind: 'relation',
        root: {
          kind: 'and',
          children: [
            { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: 'data-flow' },
            {
              kind: 'or',
              children: [
                { kind: 'predicate', path: [], fieldId: 'a', op: 'equals', value: '1' },
                { kind: 'predicate', path: [], fieldId: 'b', op: 'equals', value: '2' }
              ]
            }
          ]
        }
      })
    ).toBe(false);
  });

  it('is not representable when a predicate traverses via relationForward', () => {
    expect(
      isRelationBasicRepresentable({
        root_kind: 'relation',
        root: {
          kind: 'predicate',
          path: [{ kind: 'relationForward', fieldId: 'data_entities' }],
          fieldId: 'classification',
          op: 'in',
          value: ['sensitive']
        }
      })
    ).toBe(false);
  });

  it('is not representable when the query carries projections', () => {
    expect(
      isRelationBasicRepresentable({
        root_kind: 'relation',
        root: { kind: 'and', children: [] },
        projections: [{ path: [], fieldId: 'name', alias: 'x' }]
      })
    ).toBe(false);
  });

  it('drops the or node when flattened, matching what triggered the bug', () => {
    const query = {
      root_kind: 'relation' as const,
      root: {
        kind: 'and' as const,
        children: [
          {
            kind: 'predicate' as const,
            path: [],
            fieldId: '_schemaId',
            op: 'equals' as const,
            value: 'data-flow'
          },
          {
            kind: 'or' as const,
            children: [
              {
                kind: 'predicate' as const,
                path: [],
                fieldId: 'a',
                op: 'equals' as const,
                value: '1'
              }
            ]
          }
        ]
      }
    };
    expect(filterConditionsFromRelationQuery(query)).toEqual([
      { fieldId: '_schemaId', op: 'equals', value: 'data-flow' }
    ]);
    expect(isRelationBasicRepresentable(query)).toBe(false);
  });
});
