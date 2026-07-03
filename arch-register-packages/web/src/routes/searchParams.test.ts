import { describe, expect, it } from 'vitest';
import {
  validateEntityDetailSearch,
  validateEntitySearch,
  validateMarkdownSearch,
  validateProjectSearch,
  validateSearchSearch
} from './searchParams';

describe('validateEntityDetailSearch', () => {
  it('accepts reloadable entity tabs and rejects unknown tabs', () => {
    expect(validateEntityDetailSearch({ tab: 'topology', contentFolder: 'Operations' })).toEqual({
      tab: 'topology',
      contentFolder: 'Operations'
    });
    expect(validateEntityDetailSearch({ tab: 'unknown' })).toEqual({
      tab: undefined,
      contentFolder: undefined
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
        sidebarTab: 'views',
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
      filters: undefined,
    });
  });

  it('drops invalid optional values', () => {
    expect(
      validateEntitySearch({
        type: 123,
        viewMode: 'kanban',
        sidebarTab: 'other',
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
      filters: undefined,
    });
  });
});

describe('validateProjectSearch', () => {
  it('parses shared entity browser state on project routes', () => {
    expect(
      validateProjectSearch({
        tab: 'projects',
        section: 'entities',
        q: 'auth',
        viewMode: 'timeline',
        sort: 'date:goLive',
        projectScope: 'project',
        filters: '[{"fieldId":"_schemaId","op":"equals","value":"application"}]'
      })
    ).toEqual({
      tab: 'projects',
      folder: undefined,
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
      compareMode: undefined,
    });
  });

  it('parses compare-to-current params', () => {
    expect(
      validateMarkdownSearch({
        panel: 'history',
        revisionId: 'rev-3',
        historyMode: 'compare',
        compareMode: 'to-current',
      })
    ).toEqual({
      mode: undefined,
      panel: 'history',
      revisionId: 'rev-3',
      historyMode: 'compare',
      compareMode: 'to-current',
    });
  });

  it('parses changes-in-version params', () => {
    expect(
      validateMarkdownSearch({
        panel: 'history',
        revisionId: 'rev-3',
        historyMode: 'compare',
        compareMode: 'changes-in-version',
      })
    ).toEqual({
      mode: undefined,
      panel: 'history',
      revisionId: 'rev-3',
      historyMode: 'compare',
      compareMode: 'changes-in-version',
    });
  });

  it('drops invalid historyMode and compareMode values', () => {
    expect(
      validateMarkdownSearch({
        historyMode: 'audit',
        compareMode: 'diff',
      })
    ).toEqual({
      mode: undefined,
      panel: undefined,
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
    });
  });
});
