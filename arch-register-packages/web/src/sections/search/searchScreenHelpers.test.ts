import { describe, expect, it } from 'vitest';
import { getFileContextLabel, getFileFolder, snippetAround } from './searchScreenHelpers';
import type { ProjectFileSearchResult } from '@arch-register/api-types/searchContract';

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
