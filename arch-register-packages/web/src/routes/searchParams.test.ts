import { describe, expect, it } from 'vitest';
import {
  validateEntityDetailSearch,
  validateEntitySearch,
  validateModelOverviewSearch,
  validateMarkdownSearch,
  validateProjectSearch,
  validateSearchSearch,
  validateWorkspaceContentSearch
} from './searchParams';

describe('validateWorkspaceContentSearch', () => {
  it('accepts content filter state and excludes folder selection from search', () => {
    expect(
      validateWorkspaceContentSearch({
        contentFolder: 'docs/guides',
        contentQuery: 'api',
        contentView: 'list'
      })
    ).toEqual({ contentQuery: 'api', contentView: 'list' });
  });

  it('drops invalid content filter state', () => {
    expect(validateWorkspaceContentSearch({ contentQuery: 123, contentView: 'table' })).toEqual({
      contentQuery: undefined,
      contentView: undefined
    });
  });
});

describe('validateEntityDetailSearch', () => {
  it('accepts reloadable entity tabs and rejects unknown tabs', () => {
    expect(
      validateEntityDetailSearch({
        tab: 'topology',
        contentFolder: 'Operations',
        contentQuery: 'guide',
        contentView: 'list'
      })
    ).toEqual({
      tab: 'topology',
      contentQuery: 'guide',
      contentView: 'list'
    });
    expect(
      validateEntityDetailSearch({ tab: 'unknown', contentFolder: 'legacy', contentView: 'kanban' })
    ).toEqual({
      tab: undefined,
      contentQuery: undefined,
      contentView: undefined
    });
    expect(validateEntityDetailSearch({ tab: 'discussions' })).toEqual({
      tab: 'discussions',
      contentQuery: undefined,
      contentView: undefined
    });
  });
});

describe('validateSearchSearch', () => {
  it('accepts search categories and rejects unknown categories', () => {
    expect(validateSearchSearch({ q: 'api', category: 'entities' })).toEqual({
      q: 'api',
      category: 'entities'
    });
    expect(validateSearchSearch({ q: 'api', category: 'unknown' })).toEqual({
      q: 'api',
      category: undefined
    });
  });
});

describe('validateEntitySearch', () => {
  it('parses entity browser search params used by saved views', () => {
    expect(
      validateEntitySearch({
        type: 'application',
        status: 'production',
        owner: 'Platform Engineering',
        q: 'auth',
        viewId: 'view-123',
        viewMode: 'explore',
        sort: 'owner',
        projectScope: 'all',
        viewConfigs:
          '{"radar":{"schemaId":"application"},"timeline":{"groupBy":"owner"},"hierarchy":{"levels":2},"explore":{"leftDepth":2,"rightDepth":1,"relationFieldNames":["Depends On"]}}',
        sidebarTab: 'views'
      })
    ).toEqual({
      type: 'application',
      status: 'production',
      owner: 'Platform Engineering',
      q: 'auth',
      viewId: 'view-123',
      viewMode: 'explore',
      sort: 'owner',
      projectScope: 'all',
      viewConfigs:
        '{"radar":{"schemaId":"application"},"timeline":{"groupBy":"owner"},"hierarchy":{"levels":2},"explore":{"leftDepth":2,"rightDepth":1,"relationFieldNames":["Depends On"]}}',
      sidebarTab: 'views',
      filters: undefined
    });
  });

  it('drops invalid optional values', () => {
    expect(
      validateEntitySearch({
        type: 123,
        viewMode: 'kanban',
        sidebarTab: 'other'
      })
    ).toEqual({
      type: undefined,
      status: undefined,
      owner: undefined,
      q: undefined,
      viewId: undefined,
      viewMode: undefined,
      sort: undefined,
      projectScope: undefined,
      viewConfigs: undefined,
      sidebarTab: undefined,
      filters: undefined
    });
  });
});

describe('validateProjectSearch', () => {
  it('parses shared entity browser state on project routes', () => {
    expect(
      validateProjectSearch({
        tab: 'projects',
        section: 'entities',
        folder: 'legacy-folder',
        q: 'auth',
        viewMode: 'timeline',
        sort: 'date:goLive',
        projectScope: 'project',
        filters: '[{"fieldId":"_schemaId","op":"equals","value":"application"}]',
        contentQuery: 'diagram',
        contentView: 'list'
      })
    ).toEqual({
      tab: 'projects',
      section: 'entities',
      dialog: undefined,
      type: undefined,
      status: undefined,
      owner: undefined,
      q: 'auth',
      viewId: undefined,
      viewMode: 'timeline',
      sort: 'date:goLive',
      projectScope: 'project',
      viewConfigs: undefined,
      sidebarTab: undefined,
      filters: '[{"fieldId":"_schemaId","op":"equals","value":"application"}]',
      contentQuery: 'diagram',
      contentView: 'list'
    });
  });

  it('accepts a valid assessmentTab and rejects unknown ones', () => {
    expect(
      validateProjectSearch({ assessmentId: 'a1', assessmentTab: 'discussion' })
    ).toMatchObject({
      assessmentId: 'a1',
      assessmentTab: 'discussion'
    });
    expect(validateProjectSearch({ assessmentTab: 'bogus' })).toMatchObject({
      assessmentTab: undefined
    });
  });
});

describe('validateMarkdownSearch', () => {
  it('parses markdown screen params', () => {
    expect(
      validateMarkdownSearch({
        mode: 'preview',
        panel: 'history',
        revisionId: 'rev-123'
      })
    ).toEqual({
      mode: 'preview',
      panel: 'history',
      revisionId: 'rev-123',
      historyMode: undefined,
      compareMode: undefined
    });
  });

  it('parses compare-to-current params', () => {
    expect(
      validateMarkdownSearch({
        panel: 'history',
        revisionId: 'rev-3',
        historyMode: 'compare',
        compareMode: 'to-current'
      })
    ).toEqual({
      mode: undefined,
      panel: 'history',
      revisionId: 'rev-3',
      historyMode: 'compare',
      compareMode: 'to-current'
    });
  });

  it('parses changes-in-version params', () => {
    expect(
      validateMarkdownSearch({
        panel: 'history',
        revisionId: 'rev-3',
        historyMode: 'compare',
        compareMode: 'changes-in-version'
      })
    ).toEqual({
      mode: undefined,
      panel: 'history',
      revisionId: 'rev-3',
      historyMode: 'compare',
      compareMode: 'changes-in-version'
    });
  });

  it('drops invalid historyMode and compareMode values', () => {
    expect(
      validateMarkdownSearch({
        historyMode: 'audit',
        compareMode: 'diff'
      })
    ).toEqual({
      mode: undefined,
      panel: undefined,
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined
    });
  });
});

describe('validateModelOverviewSearch', () => {
  it('parses valid model overview params and omits defaults', () => {
    expect(
      validateModelOverviewSearch({
        layout: 'force',
        horizontalSpacing: '240',
        verticalSpacing: '120',
        iterations: '450',
        springStrength: '0.8',
        repulsionStrength: '1.6',
        idealEdgeLength: '220',
        crossingMinimizationIterations: '10'
      })
    ).toEqual({
      layout: 'force',
      horizontalSpacing: 240,
      verticalSpacing: 120,
      iterations: 450,
      springStrength: 0.8,
      repulsionStrength: 1.6,
      idealEdgeLength: 220,
      crossingMinimizationIterations: undefined
    });
  });

  it('drops invalid model overview params', () => {
    expect(
      validateModelOverviewSearch({
        layout: 'grid',
        horizontalSpacing: '49',
        verticalSpacing: 'wide',
        iterations: '55.5',
        springStrength: '0.05',
        repulsionStrength: '8',
        idealEdgeLength: '40',
        crossingMinimizationIterations: '0'
      })
    ).toEqual({
      layout: undefined,
      horizontalSpacing: undefined,
      verticalSpacing: undefined,
      iterations: undefined,
      springStrength: undefined,
      repulsionStrength: undefined,
      idealEdgeLength: undefined,
      crossingMinimizationIterations: undefined
    });
  });

  it('drops the default hierarchy layout marker', () => {
    expect(validateModelOverviewSearch({ layout: 'hierarchy' })).toEqual({
      layout: undefined,
      horizontalSpacing: undefined,
      verticalSpacing: undefined,
      iterations: undefined,
      springStrength: undefined,
      repulsionStrength: undefined,
      idealEdgeLength: undefined,
      crossingMinimizationIterations: undefined
    });
  });
});
