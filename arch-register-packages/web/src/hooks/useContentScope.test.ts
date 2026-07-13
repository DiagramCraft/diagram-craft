import { describe, expect, it, vi } from 'vitest';
import {
  contentDownloadUrl,
  contentScopeKey,
  contentScopeReady,
  contentUploadUrl,
  invalidateContentScope
} from './useContentScope';

describe('content scope adapter', () => {
  it('uses scope-specific query keys', () => {
    expect(contentScopeKey({ kind: 'project', workspaceId: 'ws', projectId: 'project' })).toEqual([
      'project-files',
      'list',
      'ws',
      'project'
    ]);
    expect(contentScopeKey({ kind: 'entity', workspaceId: 'ws', entityId: 'entity' })).toEqual([
      'entity-content',
      'ws',
      'entity'
    ]);
    expect(contentScopeKey({ kind: 'workspace', workspaceId: 'ws' })).toEqual([
      'workspace-content',
      'ws'
    ]);
  });

  it('builds scope-specific download URLs', () => {
    expect(
      contentDownloadUrl({ kind: 'project', workspaceId: 'ws', projectId: 'p' }, 'a b/x.json')
    ).toBe('/api/ws/projects/p/files/download?path=a%20b%2Fx.json');
    expect(contentDownloadUrl({ kind: 'entity', workspaceId: 'ws', entityId: 'e' }, 'x.json')).toBe(
      '/api/ws/entities/e/content/files/download?path=x.json'
    );
    expect(contentDownloadUrl({ kind: 'workspace', workspaceId: 'ws' }, 'x.json')).toBe(
      '/api/ws/content/files/download?path=x.json'
    );
  });

  it('builds scope-specific upload URLs', () => {
    expect(contentUploadUrl({ kind: 'project', workspaceId: 'ws', projectId: 'p' })).toBe(
      '/api/ws/projects/p/files/upload'
    );
    expect(contentUploadUrl({ kind: 'entity', workspaceId: 'ws', entityId: 'e' })).toBe(
      '/api/ws/entities/e/content/files/upload'
    );
    expect(contentUploadUrl({ kind: 'workspace', workspaceId: 'ws' })).toBe(
      '/api/ws/content/files/upload'
    );
  });

  it('requires every identifier needed by the selected scope', () => {
    expect(contentScopeReady({ kind: 'workspace', workspaceId: 'ws' })).toBe(true);
    expect(contentScopeReady({ kind: 'workspace', workspaceId: '' })).toBe(false);
    expect(contentScopeReady({ kind: 'project', workspaceId: 'ws', projectId: 'p' })).toBe(true);
    expect(contentScopeReady({ kind: 'project', workspaceId: 'ws', projectId: '' })).toBe(false);
    expect(contentScopeReady({ kind: 'entity', workspaceId: 'ws', entityId: 'e' })).toBe(true);
    expect(contentScopeReady({ kind: 'entity', workspaceId: 'ws', entityId: '' })).toBe(false);
  });

  it('invalidates content, related entity diagrams, and audit queries', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const client = { invalidateQueries } as never;
    await invalidateContentScope(client, { kind: 'entity', workspaceId: 'ws', entityId: 'e' });
    await invalidateContentScope(client, { kind: 'workspace', workspaceId: 'ws' });
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ['entity-content', 'ws', 'e'] },
      { queryKey: ['entity-diagram-files', 'ws', 'e'] },
      { queryKey: ['audit', 'log', 'ws'] },
      { queryKey: ['audit', 'stats', 'ws'] },
      { queryKey: ['workspace-analytics', 'ws'] },
      { queryKey: ['workspace-content', 'ws'] },
      { queryKey: ['audit', 'log', 'ws'] },
      { queryKey: ['audit', 'stats', 'ws'] },
      { queryKey: ['workspace-analytics', 'ws'] }
    ]);
  });
});
