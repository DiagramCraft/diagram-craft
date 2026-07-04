import { describe, expect, it, vi } from 'vitest';
import { contentDownloadUrl, contentScopeKey, invalidateContentScope } from './useContentScope';

describe('content scope adapter', () => {
  it('uses scope-specific query keys', () => {
    expect(contentScopeKey({ kind: 'project', workspaceId: 'ws', projectId: 'project' }))
      .toEqual(['project-files', 'list', 'ws', 'project']);
    expect(contentScopeKey({ kind: 'entity', workspaceId: 'ws', entityId: 'entity' }))
      .toEqual(['entity-content', 'ws', 'entity']);
    expect(contentScopeKey({ kind: 'workspace', workspaceId: 'ws' }))
      .toEqual(['workspace-content', 'ws']);
  });

  it('builds scope-specific download URLs', () => {
    expect(contentDownloadUrl({ kind: 'project', workspaceId: 'ws', projectId: 'p' }, 'a b/x.json'))
      .toBe('/api/ws/projects/p/files/download?path=a%20b%2Fx.json');
    expect(contentDownloadUrl({ kind: 'entity', workspaceId: 'ws', entityId: 'e' }, 'x.json'))
      .toBe('/api/ws/entities/e/content/files/download?path=x.json');
    expect(contentDownloadUrl({ kind: 'workspace', workspaceId: 'ws' }, 'x.json'))
      .toBe('/api/ws/content/files/download?path=x.json');
  });

  it('invalidates the exact entity and workspace content keys', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const client = { invalidateQueries } as never;
    await invalidateContentScope(client, { kind: 'entity', workspaceId: 'ws', entityId: 'e' });
    await invalidateContentScope(client, { kind: 'workspace', workspaceId: 'ws' });
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['entity-content', 'ws', 'e'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['workspace-content', 'ws'] });
  });
});
