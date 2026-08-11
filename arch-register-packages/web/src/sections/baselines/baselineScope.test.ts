import { describe, expect, it } from 'vitest';
import { buildEntityBaselineScope } from './baselineScope';

const base = {
  typeFilter: null,
  conditions: [],
  q: ''
};

describe('buildEntityBaselineScope', () => {
  it('uses the whole workspace when there are no active filters', () => {
    expect(buildEntityBaselineScope(base)).toMatchObject({
      scope: { kind: 'workspace' },
      query: null,
      label: 'Entire workspace'
    });
  });

  it('preserves the current filtered query', () => {
    const result = buildEntityBaselineScope({
      ...base,
      typeFilter: 'schema-1',
      q: 'payments'
    });

    expect(result.scope).toEqual({ kind: 'workspace' });
    expect(result.query).toMatchObject({
      schemaId: 'schema-1',
      root: { kind: 'and' }
    });
    expect(JSON.stringify(result.query)).toContain('payments');
  });

  it('pins a saved-view source while retaining the current query', () => {
    expect(
      buildEntityBaselineScope({
        ...base,
        viewId: 'view-1',
        viewName: 'Production services'
      })
    ).toMatchObject({
      scope: { kind: 'saved_view', viewId: 'view-1' },
      label: 'Saved view: Production services'
    });
  });

  it('preserves collection membership as part of the query', () => {
    expect(
      buildEntityBaselineScope({
        ...base,
        collectionId: 'collection-1',
        collectionName: 'Review queue'
      })
    ).toMatchObject({
      scope: { kind: 'workspace' },
      query: { collectionId: 'collection-1' },
      label: 'Collection: Review queue'
    });
  });
});
