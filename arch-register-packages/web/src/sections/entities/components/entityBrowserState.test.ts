import { describe, expect, it } from 'vitest';
import {
  addFreeTextQuery,
  buildSavedViewPayload,
  buildEntityQueryFromBrowserFilters,
  isEntityInProject,
  parseJsonConfig,
  parseEntityQueryFromSearch,
  parseViewConfigs,
  pruneAssessmentReferences,
  serializeViewConfigs,
  toSavedViewConfig,
  toSavedViewSearch
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
