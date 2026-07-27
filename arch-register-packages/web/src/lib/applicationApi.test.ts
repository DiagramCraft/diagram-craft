import { describe, expect, it } from 'vitest';
import { applicationCatalogPath, toApplicationApiUrl } from './applicationApi';

describe('application API paths', () => {
  it('maps legacy catalog URLs to application v1', () => {
    expect(toApplicationApiUrl('/api/default/data?view=full')).toBe(
      '/api/application/v1/default/data?view=full'
    );
    expect(toApplicationApiUrl('https://example.test/api/default/schemas/one')).toBe(
      'https://example.test/api/application/v1/default/schemas/one'
    );
  });

  it('leaves auth and unrelated workspace routes unchanged', () => {
    expect(toApplicationApiUrl('/api/auth/refresh')).toBe('/api/auth/refresh');
    expect(toApplicationApiUrl('/api/default/watch')).toBe('/api/default/watch');
  });

  it('maps project and content calls to application v1', () => {
    expect(toApplicationApiUrl('/api/default/projects/project-1/files')).toBe(
      '/api/application/v1/default/projects/project-1/files'
    );
    expect(toApplicationApiUrl('/api/default/content/markdown')).toBe(
      '/api/application/v1/default/content/markdown'
    );
  });

  it('maps workflow calls to application v1', () => {
    expect(toApplicationApiUrl('/api/default/assessments')).toBe(
      '/api/application/v1/default/assessments'
    );
    expect(toApplicationApiUrl('/api/default/milestones')).toBe(
      '/api/application/v1/default/milestones'
    );
    expect(toApplicationApiUrl('/api/default/data/entity-1/versions')).toBe(
      '/api/application/v1/default/data/entity-1/versions'
    );
  });

  it('maps dashboard calls to application v1', () => {
    expect(toApplicationApiUrl('/api/default/dashboard')).toBe(
      '/api/application/v1/default/dashboard'
    );
  });

  it('maps workspace control-plane calls to application v1', () => {
    expect(toApplicationApiUrl('/api/workspaces')).toBe('/api/application/v1/workspaces');
    expect(toApplicationApiUrl('/api/workspaces/templates')).toBe(
      '/api/application/v1/workspaces/templates'
    );
  });

  it('builds encoded application catalog paths', () => {
    expect(applicationCatalogPath('workspace/one', '/data/facets')).toBe(
      '/api/application/v1/workspace%2Fone/data/facets'
    );
  });
});
