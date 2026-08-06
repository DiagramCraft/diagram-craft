import { describe, expect, it } from 'vitest';
import {
  buildRelationQueryFromFilters,
  buildRelationSavedViewPayload,
  endpointFieldId,
  getRelationGraphLabelOptions,
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
        config: { graph: { edgeLabelFieldId: 'status' } }
      } as never)
    ).toMatchObject({ viewId: 'view-1', edgeLabelFieldId: 'status' });
  });

  it('persists graph edge label configuration and exposes relation fields as options', () => {
    expect(
      buildRelationSavedViewPayload({
        name: 'Graph',
        description: '',
        isAdminView: false,
        viewMode: 'graph',
        conditions: [],
        edgeLabelFieldId: 'status'
      }).config
    ).toEqual({ graph: { edgeLabelFieldId: 'status' } });

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
