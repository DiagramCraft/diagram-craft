import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  addFreeTextQuery,
  buildSavedViewPayload,
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  getPersistedViewConfig,
  getFirstFilteredSchemaId,
  isBasicRepresentable,
  isEntityInProject,
  parseConditionsFromSearch,
  parseJsonConfig,
  parseEntityQueryFromSearch,
  parseFacetSelectionFromConditions,
  parseViewConfigs,
  pruneAssessmentReferences,
  replaceFacetConditions,
  resetExploreRelationFilter,
  serializeSavedViewDefinitionForDebug,
  serializeViewConfigs,
  stripEmptyGroups,
  toSavedViewConfig,
  toSavedViewSearch,
  withLiveSearchText,
  withSchemaIdAsPredicate
} from './entityBrowserState';

describe('project entity membership highlighting', () => {
  const linked = { linked: true, entityType: null, isDone: false };
  const notLinked = { linked: false, entityType: null, isDone: false };
  const cases: Array<[Parameters<typeof isEntityInProject>[0], boolean]> = [
    [{ _projectId: 'project-1', _projectLink: undefined }, true],
    [{ _projectId: null, _projectLink: linked }, true],
    [{ _projectId: 'project-2', _projectLink: linked }, true],
    [{ _projectId: null, _projectLink: notLinked }, false]
  ];

  it.each(cases)('recognizes project membership for %j', (entity, expected) => {
    expect(isEntityInProject(entity, 'project-1')).toBe(expected);
  });
});

describe('filtered entity defaults', () => {
  it('uses the first filtered entity schema for new entity creation', () => {
    expect(
      getFirstFilteredSchemaId([
        { _schema: { id: 'vendor', name: 'Vendor' } },
        { _schema: { id: 'contract', name: 'Contract' } }
      ])
    ).toBe('vendor');
    expect(getFirstFilteredSchemaId([])).toBeNull();
  });
});

describe('entity browser view field persistence', () => {
  it.each(['table', 'cards', 'tree'] as const)('saves %s field configuration', view => {
    expect(toSavedViewConfig(view, { [view]: { fieldIds: ['_owner', 'technology'] } })).toEqual({
      [view]: { fieldIds: ['_owner', 'technology'] }
    });
  });

  it('round trips independent selections through the URL payload', () => {
    const configs = { table: { fieldIds: ['a'] }, cards: { fieldIds: ['b'] } };
    expect(parseViewConfigs(serializeViewConfigs(configs))).toEqual(configs);
  });

  it('saves a map configuration, including levels/columns and metricConfig', () => {
    const mapConfig = {
      levels: 3,
      level1SchemaId: 's-domain',
      level1Columns: 3,
      level2SchemaId: 's-capability',
      level2Columns: 2,
      level3SchemaId: 's-service',
      level3Columns: 4,
      metricConfig: {
        sourceSchemaId: 's-service',
        source: { kind: 'field', fieldId: 'score' },
        aggregation: 'average'
      }
    };
    expect(toSavedViewConfig('map', { map: mapConfig })).toEqual({ map: mapConfig });
    expect(parseViewConfigs(serializeViewConfigs({ map: mapConfig }))).toEqual({ map: mapConfig });
  });

  it('persists entity graph traversal settings in URL and saved-view configuration', () => {
    const graphConfig = {
      maxDepth: 3,
      direction: 'downstream' as const,
      relationSchemaIds: ['relation-schema']
    };
    const configs = { graph: graphConfig };

    expect(parseViewConfigs(serializeViewConfigs(configs))).toEqual(configs);
    expect(toSavedViewConfig('graph', configs)).toEqual({ graph: graphConfig });
  });

  it('persists traceability paths through browser and saved-view state', () => {
    const traceabilityConfig = {
      paths: [
        {
          id: 'supports',
          label: 'Supports',
          path: [{ kind: 'unboundTypedRelation', relationSchemaId: 'supports', direction: 'in' }],
          targetSchemaIds: 'any'
        }
      ],
      deliverySources: ['projects'],
      showOrphanEntities: true,
      showOrphanProjects: true
    };
    const configs = { traceability: traceabilityConfig };

    expect(parseViewConfigs(serializeViewConfigs(configs))).toEqual(configs);
    expect(toSavedViewConfig('traceability', configs)).toEqual({
      traceability: traceabilityConfig
    });
  });

  it('restores graph mode and traversal settings from a saved view', () => {
    const search = toSavedViewSearch({
      id: 'graph-view',
      workspaceId: 'workspace-1',
      scope: 'workspace',
      projectId: null,
      projectScope: null,
      name: 'Dependencies',
      description: null,
      isAdminView: false,
      viewMode: 'graph',
      filters: { root: { kind: 'and', children: [] } },
      config: { graph: { maxDepth: 3, direction: 'upstream', relationSchemaIds: ['r'] } },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(search.viewMode).toBe('graph');
    expect(parseViewConfigs(search.viewConfigs)).toEqual({
      graph: { maxDepth: 3, direction: 'upstream', relationSchemaIds: ['r'] }
    });
  });

  it('round trips bubble quadrant configuration through browser and saved-view state', () => {
    const bubbleConfig = {
      xFieldId: 'technical-fit',
      yFieldId: 'business-fit',
      sizeFieldId: 'cost',
      colorFieldId: null,
      quadrants: {
        enabled: true,
        labels: {
          topLeft: 'Invest',
          topRight: 'Strategic',
          bottomLeft: 'Deprioritize',
          bottomRight: 'Maintain'
        }
      }
    };
    const configs = { bubble: bubbleConfig };

    expect(parseViewConfigs(serializeViewConfigs(configs))).toEqual(configs);
    expect(toSavedViewConfig('bubble', configs)).toEqual({ bubble: bubbleConfig });
  });

  it('rejects malformed and non-object view-config payloads', () => {
    expect(parseViewConfigs('{')).toEqual({});
    expect(parseViewConfigs('[]')).toEqual({});
    expect(parseViewConfigs('null')).toEqual({});
    expect(serializeViewConfigs({})).toBeUndefined();
  });

  it('returns no persisted config when browser storage is unavailable', () => {
    expect(getPersistedViewConfig('radar', 'workspace-1')).toBeNull();
  });

  it('resets Explore relation filters while preserving other view settings', () => {
    const configs = {
      explore: {
        leftDepth: 2,
        rightDepth: 3,
        relationKeys: ['service->api'],
        relationFieldNames: ['depends on']
      },
      table: { fieldIds: ['_owner'] }
    };

    expect(resetExploreRelationFilter(configs)).toEqual({
      explore: {
        leftDepth: 2,
        rightDepth: 3,
        relationFieldNames: []
      },
      table: { fieldIds: ['_owner'] }
    });
  });

  it('returns null for missing or malformed individual JSON configs', () => {
    expect(parseJsonConfig(undefined)).toBeNull();
    expect(parseJsonConfig('')).toBeNull();
    expect(parseJsonConfig('{')).toBeNull();
    expect(parseJsonConfig<{ fieldIds: string[] }>(JSON.stringify({ fieldIds: ['a'] }))).toEqual({
      fieldIds: ['a']
    });
  });
});

describe('pruneAssessmentReferences', () => {
  it('strips assessment presence and field conditions', () => {
    const { conditions } = pruneAssessmentReferences(
      [
        { fieldId: '_schemaId', op: 'equals', value: 'x' },
        { fieldId: '_assessment', op: 'not_empty', value: undefined },
        { fieldId: '_assessment:rating1', op: 'gte', value: 3 }
      ],
      {}
    );
    expect(conditions).toEqual([{ fieldId: '_schemaId', op: 'equals', value: 'x' }]);
  });

  it('strips assessment field ids from table/cards/tree fieldIds arrays', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      table: { fieldIds: ['_owner', '_assessment:rating1', 'technology'] }
    });
    expect(viewConfigs.table).toEqual({ fieldIds: ['_owner', 'technology'] });
  });

  it('clears radar quadrant/ring fields and matrix colEnumFieldId when they reference the assessment', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      radar: {
        schemaId: 's',
        quadrantFieldId: '_assessment:enum1',
        ringFieldId: 'severity',
        ringOrder: []
      },
      matrix: {
        colMode: 'attribute',
        colSchemaId: null,
        colEnumFieldId: '_assessment:enum1',
        filterFieldName: null,
        hideEmptyRows: false,
        hideEmptyCols: false
      }
    });
    expect(viewConfigs.radar).toMatchObject({ quadrantFieldId: '', ringFieldId: 'severity' });
    expect(viewConfigs.matrix).toMatchObject({ colEnumFieldId: null });
  });

  it('leaves configs without assessment references untouched', () => {
    const configs = { table: { fieldIds: ['_owner', 'technology'] } };
    const { viewConfigs } = pruneAssessmentReferences([], configs);
    expect(viewConfigs).toEqual(configs);
  });

  it('clears an assessment-sourced map metricConfig entirely', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      map: {
        levels: 2,
        level1SchemaId: 's1',
        level1Columns: 3,
        level2SchemaId: null,
        level2Columns: 3,
        level3SchemaId: null,
        level3Columns: 3,
        metricConfig: {
          sourceSchemaId: 's1',
          source: { kind: 'assessmentRating', fieldId: 'rating1' },
          aggregation: 'average'
        }
      }
    });
    expect(viewConfigs.map).toMatchObject({ level1SchemaId: 's1', metricConfig: null });
  });

  it('leaves a non-assessment-sourced map metricConfig untouched', () => {
    const configs = {
      map: {
        levels: 2,
        level1SchemaId: 's1',
        level1Columns: 3,
        level2SchemaId: null,
        level2Columns: 3,
        level3SchemaId: null,
        level3Columns: 3,
        metricConfig: {
          sourceSchemaId: 's1',
          source: { kind: 'lifecycle' },
          aggregation: 'worst',
          worstDirection: 'high'
        }
      }
    };
    const { viewConfigs } = pruneAssessmentReferences([], configs);
    expect(viewConfigs).toEqual(configs);
  });
});

describe('structured entity query view persistence', () => {
  const entityQuery = {
    schemaId: 'component',
    root: {
      kind: 'predicate' as const,
      path: [{ kind: 'forward' as const, fieldId: 'technology_releases' }],
      fieldId: 'eol_date',
      op: 'before' as const,
      value: '2026-06-30'
    }
  };

  it('round trips an entity query through saved-view URL state', () => {
    const search = toSavedViewSearch({
      id: 'view-1',
      workspaceId: 'workspace-1',
      scope: 'workspace',
      projectId: null,
      projectScope: null,
      name: 'At risk',
      description: null,
      isAdminView: false,
      viewMode: 'table',
      filters: entityQuery,
      config: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(parseEntityQueryFromSearch(search)).toEqual(entityQuery);
  });

  it('persists the canonical query without legacy filter fields', () => {
    const payload = buildSavedViewPayload({
      scope: 'workspace',
      name: 'At risk',
      description: '',
      view: 'table',
      typeFilter: 'component',
      statusFilter: null,
      ownerFilter: null,
      q: '',
      sort: 'name',
      conditions: [],
      viewConfigs: {},
      entityQuery
    });

    expect(payload.filters).toEqual(entityQuery);
    expect(payload.filters).not.toHaveProperty('conditions');
  });

  it('encodes free-text search in the query and sort in display configuration', () => {
    const payload = buildSavedViewPayload({
      scope: 'workspace',
      name: 'Search view',
      description: '',
      view: 'table',
      typeFilter: 'component',
      statusFilter: null,
      ownerFilter: null,
      q: 'platform',
      sort: 'owner',
      conditions: [],
      viewConfigs: {}
    });

    expect(payload.filters.root.kind).toBe('and');
    const textNode = payload.filters.root.kind === 'and' ? payload.filters.root.children[0] : null;
    expect(textNode).toEqual({ kind: 'freeText', value: 'platform' });
    expect(payload.config).toEqual({ sort: 'owner' });

    expect(serializeSavedViewDefinitionForDebug(payload)).toBe(
      JSON.stringify(
        {
          viewMode: 'table',
          filters: payload.filters,
          config: { sort: 'owner' }
        },
        null,
        2
      )
    );

    const search = toSavedViewSearch({
      id: 'view-search',
      workspaceId: 'workspace-1',
      scope: 'workspace',
      projectId: null,
      projectScope: null,
      name: 'Search view',
      description: null,
      isAdminView: false,
      viewMode: 'table',
      filters: payload.filters,
      config: payload.config ?? null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(search.q).toBe('platform');
    expect(search.sort).toBe('owner');
  });

  it('replaces an existing free-text clause when the search changes', () => {
    const query = buildEntityQueryFromBrowserFilters({
      typeFilter: 'component',
      conditions: [],
      q: 'old'
    });

    const updated = addFreeTextQuery(query, 'new');
    expect(updated.root.kind === 'and' ? updated.root.children : []).toContainEqual({
      kind: 'freeText',
      value: 'new'
    });
  });

  it('migrates the legacy three-field free-text clause when the search changes', () => {
    const query = {
      schemaId: 'component',
      root: {
        kind: 'and' as const,
        children: [
          {
            kind: 'or' as const,
            children: (['_name', '_slug', '_description'] as const).map(fieldId => ({
              kind: 'predicate' as const,
              path: [],
              fieldId,
              op: 'contains' as const,
              value: 'old'
            }))
          }
        ]
      }
    };

    expect(addFreeTextQuery(query, 'new').root).toEqual({
      kind: 'and',
      children: [{ kind: 'freeText', value: 'new' }]
    });
  });

  it('removes the free-text node for an empty browser search', () => {
    const query = buildEntityQueryFromBrowserFilters({
      typeFilter: 'component',
      conditions: [],
      q: 'old'
    });

    expect(addFreeTextQuery(query, '  ').root).toEqual({ kind: 'and', children: [] });
  });

  it('builds an IR query when saving a flat browser filter', () => {
    expect(
      buildEntityQueryFromBrowserFilters({
        typeFilter: 'component',
        conditions: [
          { fieldId: '_schemaId', op: 'equals', value: 'component' },
          { fieldId: '_lifecycle', op: 'equals', value: 'active' }
        ]
      })
    ).toEqual({
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
        ]
      }
    });
  });

  it('persists a conformance status filter through browser and saved-view state', () => {
    const conditions = [
      { fieldId: '_conformanceStatus', op: 'equals' as const, value: 'unresolved' }
    ];
    const query = buildEntityQueryFromBrowserFilters({
      typeFilter: null,
      conditions
    });

    expect(query).toEqual({
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_conformanceStatus',
            op: 'equals',
            value: 'unresolved'
          }
        ]
      }
    });
    expect(entityQueryToBrowserFilters(query)).toEqual({ conditions, q: '' });

    const payload = buildSavedViewPayload({
      scope: 'workspace',
      name: 'Unresolved entities',
      description: '',
      view: 'table',
      typeFilter: null,
      statusFilter: null,
      ownerFilter: null,
      q: '',
      sort: 'name',
      conditions,
      viewConfigs: {}
    });
    expect(payload.filters).toEqual(query);
  });

  it('groups multiple facet values with OR and different facets with AND', () => {
    expect(
      buildEntityQueryFromBrowserFilters({
        typeFilter: null,
        conditions: [
          { fieldId: '_schemaId', op: 'equals', value: 'component' },
          { fieldId: '_schemaId', op: 'equals', value: 'service' },
          { fieldId: '_lifecycle', op: 'equals', value: 'active' },
          { fieldId: '_lifecycle', op: 'empty', value: '' },
          { fieldId: '_owner', op: 'equals', value: 'team-a' },
          { fieldId: '_owner', op: 'empty', value: '' }
        ]
      })
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          {
            kind: 'or',
            children: [
              {
                kind: 'predicate',
                path: [],
                fieldId: '_schemaId',
                op: 'equals',
                value: 'component'
              },
              { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: 'service' }
            ]
          },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' },
              { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'empty', value: '' }
            ]
          },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'team-a' },
              { kind: 'predicate', path: [], fieldId: '_owner', op: 'empty', value: '' }
            ]
          }
        ]
      }
    });
  });

  it('round trips facet selections while preserving non-facet conditions', () => {
    const conditions = [
      { fieldId: '_schemaId', op: 'equals' as const, value: 'component' },
      { fieldId: '_schemaId', op: 'equals' as const, value: 'service' },
      { fieldId: '_owner', op: 'empty' as const, value: '' },
      { fieldId: 'criticality', op: 'gte' as const, value: 3 }
    ];
    const selection = parseFacetSelectionFromConditions(conditions);
    expect(selection).toEqual({
      schemaIds: ['component', 'service'],
      lifecycleValues: [],
      ownerIds: [null]
    });
    expect(replaceFacetConditions(conditions, { ...selection, schemaIds: ['service'] })).toEqual([
      { fieldId: 'criticality', op: 'gte', value: 3 },
      { fieldId: '_schemaId', op: 'equals', value: 'service' },
      { fieldId: '_owner', op: 'empty', value: '' }
    ]);
  });

  it('stores completeness predicates directly in the canonical query', () => {
    const conditions = [{ fieldId: '_completeness', op: 'lt' as const, value: 50 }];
    const payload = buildSavedViewPayload({
      scope: 'workspace',
      name: 'Incomplete components',
      description: '',
      view: 'table',
      typeFilter: 'component',
      statusFilter: null,
      ownerFilter: null,
      q: '',
      sort: 'name',
      conditions,
      viewConfigs: {}
    });

    expect(payload.filters).toEqual({
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_completeness',
            op: 'lt',
            value: 50
          }
        ]
      }
    });

    const search = toSavedViewSearch({
      id: 'view-2',
      workspaceId: 'workspace-1',
      scope: 'workspace',
      projectId: null,
      projectScope: null,
      name: 'Incomplete components',
      description: null,
      isAdminView: false,
      viewMode: 'table',
      filters: payload.filters,
      config: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(JSON.parse(search.entityQuery!)).toEqual(payload.filters);
    expect(search.filters).toBeUndefined();
  });
});

describe('Basic/Advanced query mode representability', () => {
  it('treats a flat browser-built query as representable', () => {
    const query = buildEntityQueryFromBrowserFilters({
      typeFilter: 'component',
      conditions: [
        { fieldId: '_schemaId', op: 'equals', value: 'component' },
        { fieldId: '_lifecycle', op: 'equals', value: 'active' }
      ],
      q: 'platform'
    });

    expect(isBasicRepresentable(query)).toBe(true);
    expect(entityQueryToBrowserFilters(query)).toEqual({
      conditions: [
        { fieldId: '_lifecycle', op: 'equals', value: 'active' },
        { fieldId: '_schemaId', op: 'equals', value: 'component' }
      ],
      q: 'platform'
    });
  });

  it('treats a bare single top-level predicate (no AND wrapper) as representable', () => {
    const query: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
    };

    expect(isBasicRepresentable(query)).toBe(true);
    expect(entityQueryToBrowserFilters(query)).toEqual({
      conditions: [{ fieldId: '_lifecycle', op: 'equals', value: 'active' }],
      q: ''
    });
  });

  it('accepts OR grouping for one facet', () => {
    const query: EntityQuery = {
      root: {
        kind: 'or',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' },
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'deprecated' }
        ]
      }
    };

    expect(isBasicRepresentable(query)).toBe(true);
    expect(entityQueryToBrowserFilters(query).conditions).toEqual([
      { fieldId: '_lifecycle', op: 'equals', value: 'active' },
      { fieldId: '_lifecycle', op: 'equals', value: 'deprecated' }
    ]);
  });

  it('rejects arbitrary OR grouping', () => {
    const query: EntityQuery = {
      root: {
        kind: 'or',
        children: [
          { kind: 'predicate', path: [], fieldId: '_name', op: 'equals', value: 'A' },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'team-a' }
        ]
      }
    };

    expect(isBasicRepresentable(query)).toBe(false);
  });

  it('rejects NOT', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [{ kind: 'not', child: { kind: 'freeText', value: 'legacy' } }]
      }
    };

    expect(isBasicRepresentable(query)).toBe(false);
  });

  it('rejects relation traversal (non-empty path)', () => {
    const query: EntityQuery = {
      schemaId: 'component',
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'technology_releases' }],
        fieldId: 'eol_date',
        op: 'before',
        value: '2026-06-30'
      }
    };

    expect(isBasicRepresentable(query)).toBe(false);
  });

  it('rejects relationExists', () => {
    const query: EntityQuery = {
      root: { kind: 'relationExists', path: [{ kind: 'forward', fieldId: 'technology_releases' }] }
    };

    expect(isBasicRepresentable(query)).toBe(false);
  });

  it('rejects projections', () => {
    const query: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [{ path: [], fieldId: '_name' }]
    };

    expect(isBasicRepresentable(query)).toBe(false);
  });

  it('carries a top-level schemaId into a _schemaId condition on conversion', () => {
    const query: EntityQuery = {
      schemaId: 'component',
      root: { kind: 'and', children: [] }
    };

    expect(isBasicRepresentable(query)).toBe(true);
    expect(entityQueryToBrowserFilters(query)).toEqual({
      conditions: [{ fieldId: '_schemaId', op: 'equals', value: 'component' }],
      q: ''
    });
  });
});

// Regression: a saved view whose filter isn't captured by the legacy `type`/`status`/`owner`
// facet params (e.g. #3066's "Review Overdue", filtering on `review_date`) must still show its
// real condition(s) in Basic mode — parseConditionsFromSearch already prefers `entityQuery` when
// present, but a caller building the search object it's fed has to actually pass `entityQuery`
// through, or that preference never triggers and conditions silently fall back to the narrow
// type/status/owner-only encoding (empty for a query that only touches other fields).
describe('parseConditionsFromSearch', () => {
  it('derives conditions from entityQuery when present, not just the legacy facet params', () => {
    const query: EntityQuery = {
      schemaId: 'data-entity',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'review_date',
        op: 'before',
        value: { $now: true }
      }
    };

    expect(parseConditionsFromSearch({ entityQuery: JSON.stringify(query) } as never)).toEqual([
      { fieldId: 'review_date', op: 'before', value: { $now: true } }
    ]);
  });

  it('falls back to the legacy type/status/owner facet params when entityQuery is absent', () => {
    expect(parseConditionsFromSearch({ type: 'data-entity', status: 'active' } as never)).toEqual([
      { fieldId: '_schemaId', op: 'equals', value: 'data-entity' },
      { fieldId: '_lifecycle', op: 'equals', value: 'active' }
    ]);
  });
});

describe('stripEmptyGroups', () => {
  it('turns a lone empty group into a match-everything empty and', () => {
    expect(stripEmptyGroups({ root: { kind: 'and', children: [{ kind: 'or', children: [] }] } })).toEqual(
      { root: { kind: 'and', children: [] } }
    );
  });

  it('drops empty groups but keeps real conditions and preserves top-level fields', () => {
    const result = stripEmptyGroups({
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'api' },
          { kind: 'or', children: [] },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'a' },
              { kind: 'and', children: [] }
            ]
          }
        ]
      }
    });
    expect(result).toEqual({
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'api' },
          {
            kind: 'or',
            children: [{ kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'a' }]
          }
        ]
      }
    });
  });

  it('drops a not wrapping an empty group', () => {
    expect(
      stripEmptyGroups({
        root: {
          kind: 'and',
          children: [
            { kind: 'not', child: { kind: 'or', children: [] } },
            { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'x' }
          ]
        }
      })
    ).toEqual({
      root: {
        kind: 'and',
        children: [{ kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'x' }]
      }
    });
  });

  it('drops a blank free-text row but keeps a filled one', () => {
    expect(
      stripEmptyGroups({
        root: {
          kind: 'and',
          children: [
            { kind: 'freeText', value: '   ' },
            {
              kind: 'or',
              children: [
                { kind: 'freeText', value: 'gateway' },
                { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'a' }
              ]
            }
          ]
        }
      })
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          {
            kind: 'or',
            children: [
              { kind: 'freeText', value: 'gateway' },
              { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'a' }
            ]
          }
        ]
      }
    });
  });
});

describe('withLiveSearchText', () => {
  it('leaves an Advanced-mode freeText query untouched when the search box is empty', () => {
    // Regression: text:"analytics" in Advanced mode compiles to a bare freeText root node, and
    // the search box's own `q` stays '' since Advanced mode doesn't use it. Merging via
    // addFreeTextQuery(query, '') used to strip that node (query.root -> { kind: 'and',
    // children: [] }), silently discarding the filter and showing all entities.
    const query: EntityQuery = { root: { kind: 'freeText', value: 'analytics' } };

    expect(withLiveSearchText(query, '')).toEqual(query);
  });

  it('still merges live search-box text into the query when q is non-empty', () => {
    const query: EntityQuery = {
      schemaId: 'component',
      root: { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
    };

    expect(withLiveSearchText(query, 'platform')).toEqual({
      ...query,
      root: {
        kind: 'and',
        children: [query.root, { kind: 'freeText', value: 'platform' }]
      }
    });
  });

  it('leaves an existing freeText clause alone (not just an empty query) when q is empty', () => {
    // `q` never writes into the query's own URL-persisted freeText node (only a live merge for
    // the executed request) — so an empty search box means "nothing new to merge", not "revert
    // to no freeText", whether or not the query already carries one (e.g. a saved view's own
    // free-text term).
    const withOwnFreeText: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' },
          { kind: 'freeText', value: 'platform' }
        ]
      }
    };

    expect(withLiveSearchText(withOwnFreeText, '')).toEqual(withOwnFreeText);
  });
});

describe('withSchemaIdAsPredicate', () => {
  it('folds a top-level schemaId into a root _schemaId predicate', () => {
    // Regression: printEntityQueryText only ever renders `root`, so a Basic-mode "Type" filter
    // (which buildEntityQueryFromBrowserFilters puts on the top-level `schemaId` field, not a
    // root predicate) printed as empty text in Advanced mode with no other conditions set.
    const query: EntityQuery = {
      schemaId: 'component-schema',
      root: { kind: 'and', children: [] }
    };

    expect(withSchemaIdAsPredicate(query)).toEqual({
      schemaId: 'component-schema',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_schemaId',
            op: 'equals',
            value: 'component-schema'
          }
        ]
      }
    });
  });

  it('prepends the schema predicate ahead of existing root children', () => {
    const query: EntityQuery = {
      schemaId: 'component-schema',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
        ]
      }
    };

    expect(withSchemaIdAsPredicate(query).root).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'predicate',
          path: [],
          fieldId: '_schemaId',
          op: 'equals',
          value: 'component-schema'
        },
        { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
      ]
    });
  });

  it('wraps a non-and root (e.g. a bare freeText node) in an and alongside the schema predicate', () => {
    const query: EntityQuery = {
      schemaId: 'component-schema',
      root: { kind: 'freeText', value: 'analytics' }
    };

    expect(withSchemaIdAsPredicate(query).root).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'predicate',
          path: [],
          fieldId: '_schemaId',
          op: 'equals',
          value: 'component-schema'
        },
        { kind: 'freeText', value: 'analytics' }
      ]
    });
  });

  it('leaves the query untouched when schemaId is absent', () => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };

    expect(withSchemaIdAsPredicate(query)).toBe(query);
  });
});
