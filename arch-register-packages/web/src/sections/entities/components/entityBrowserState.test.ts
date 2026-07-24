import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  addFreeTextQuery,
  buildSavedViewPayload,
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  isBasicRepresentable,
  isEntityInProject,
  parseJsonConfig,
  parseEntityQueryFromSearch,
  parseViewConfigs,
  pruneAssessmentReferences,
  serializeViewConfigs,
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

  it('rejects malformed and non-object view-config payloads', () => {
    expect(parseViewConfigs('{')).toEqual({});
    expect(parseViewConfigs('[]')).toEqual({});
    expect(parseViewConfigs('null')).toEqual({});
    expect(serializeViewConfigs({})).toBeUndefined();
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

  it('rejects OR grouping', () => {
    const query: EntityQuery = {
      root: {
        kind: 'or',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' },
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'deprecated' }
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
