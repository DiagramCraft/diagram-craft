import { describe, expect, it } from 'vitest';
import { applicationCatalogPath } from './applicationApi';

describe('application API paths', () => {
  it('builds encoded application catalog paths', () => {
    expect(applicationCatalogPath('workspace/one', '/data/facets')).toBe(
      '/api/application/v1/workspace%2Fone/data/facets'
    );
  });
});
