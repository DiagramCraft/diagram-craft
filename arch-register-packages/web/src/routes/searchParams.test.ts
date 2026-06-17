import { describe, expect, it } from 'vitest';
import { validateEntitySearch, validateMarkdownSearch } from './searchParams';

describe('validateEntitySearch', () => {
  it('parses entity browser search params used by saved views', () => {
    expect(
      validateEntitySearch({
        type: 'application',
        status: 'production',
        owner: 'Platform Engineering',
        q: 'auth',
        viewId: 'view-123',
        viewMode: 'radar',
        radarConfig: '{"schemaId":"application"}',
        timelineConfig: '{"groupBy":"owner"}',
        sidebarTab: 'views',
      })
    ).toEqual({
      type: 'application',
      status: 'production',
      owner: 'Platform Engineering',
      q: 'auth',
      viewId: 'view-123',
      viewMode: 'radar',
      radarConfig: '{"schemaId":"application"}',
      timelineConfig: '{"groupBy":"owner"}',
      sidebarTab: 'views',
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
      radarConfig: undefined,
      timelineConfig: undefined,
      sidebarTab: undefined,
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
