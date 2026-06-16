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
      revisionId: 'rev-123'
    });
  });
});
