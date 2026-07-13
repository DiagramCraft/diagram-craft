import { describe, expect, it } from 'vitest';
import {
  buildSearchGroups,
  findSearchPreview,
  getFileContextLabel,
  getFileFolder,
  getSearchCategoryCounts,
  snippetAround
} from './searchScreenHelpers';
import type { ProjectFileSearchResult, SearchResponse } from '@arch-register/api-types/searchContract';

describe('snippetAround', () => {
  it('returns the full text untruncated when short and query empty', () => {
    expect(snippetAround('short text', '')).toBe('short text');
  });

  it('truncates long text without a query match', () => {
    const long = 'a'.repeat(200);
    expect(snippetAround(long, '')).toBe(`${'a'.repeat(140)}…`);
  });

  it('centers the snippet around the query match with ellipses', () => {
    const text = `${'x'.repeat(60)}needle${'y'.repeat(100)}`;
    const result = snippetAround(text, 'needle');
    expect(result.startsWith('…')).toBe(true);
    expect(result).toContain('needle');
  });

  it('returns empty string for null/undefined input', () => {
    expect(snippetAround(null, 'q')).toBe('');
    expect(snippetAround(undefined, 'q')).toBe('');
  });
});

describe('getFileFolder', () => {
  it('returns Root for top-level paths', () => {
    expect(getFileFolder('diagram.dgrm')).toBe('Root');
  });

  it('returns the parent path for nested files', () => {
    expect(getFileFolder('a/b/diagram.dgrm')).toBe('a/b');
  });
});

describe('getFileContextLabel', () => {
  const base = { scope: 'workspace' } as ProjectFileSearchResult;

  it('returns the project name for project-scoped files', () => {
    expect(getFileContextLabel({ ...base, scope: 'project', projectName: 'Payments' } as never)).toBe(
      'Payments'
    );
  });

  it('returns the entity name for entity-scoped files', () => {
    expect(getFileContextLabel({ ...base, scope: 'entity', entityName: 'Checkout' } as never)).toBe(
      'Checkout'
    );
  });

  it('falls back to Workspace for workspace-scoped files', () => {
    expect(getFileContextLabel(base)).toBe('Workspace');
  });
});

describe('search result transformations', () => {
  const results = {
    query: 'payments',
    entities: [{ entityId: 'entity-1', publicId: 'APP-1' }],
    projects: [{ id: 'project-1' }],
    files: [{ fileId: 'file-1' }],
    schemas: [{ schemaId: 'schema-1' }]
  } as unknown as SearchResponse;

  it('builds filtered groups in the display order', () => {
    expect(buildSearchGroups(results, 'all').map(group => group.id)).toEqual([
      'entities',
      'projects',
      'files',
      'schemas'
    ]);
    expect(buildSearchGroups(results, 'files')).toEqual([
      { id: 'files', label: 'Diagrams', rows: [{ kind: 'file', id: 'file-1', data: results.files[0] }] }
    ]);
  });

  it('counts categories and resolves selected previews', () => {
    expect(getSearchCategoryCounts(results)).toEqual({
      all: 4,
      entities: 1,
      projects: 1,
      files: 1,
      schemas: 1
    });
    expect(findSearchPreview({ kind: 'project', id: 'project-1' }, results)).toEqual({
      type: 'project',
      data: results.projects[0]
    });
    expect(findSearchPreview(null, results)).toBeNull();
  });
});
