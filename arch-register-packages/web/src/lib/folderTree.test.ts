import { describe, expect, it } from 'vitest';
import { buildFolderTree } from './folderTree';

describe('buildFolderTree', () => {
  it('sorts and nests folders by path', () => {
    expect(buildFolderTree([{ path: 'b/c' }, { path: 'a' }, { path: 'b' }])).toEqual([
      { path: 'a', name: 'a', children: [] },
      { path: 'b', name: 'b', children: [{ path: 'b/c', name: 'c', children: [] }] }
    ]);
  });

  it('keeps an orphaned nested folder reachable', () => {
    expect(buildFolderTree([{ path: 'missing/child' }])).toEqual([
      { path: 'missing/child', name: 'child', children: [] }
    ]);
  });
});
