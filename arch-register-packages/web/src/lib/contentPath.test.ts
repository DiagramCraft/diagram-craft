import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import {
  baseName,
  buildContentFolderTree,
  isContentPathTaken,
  markdownDocumentPath,
  movePath,
  parentPath,
  renamePath
} from './contentPath';

const file = (path: string, type: ProjectFile['type']): ProjectFile =>
  ({ path, type }) as ProjectFile;

describe('content path helpers', () => {
  it('finds parent paths and basenames', () => {
    expect(parentPath('a/b/file.json')).toBe('a/b');
    expect(parentPath('file.json')).toBeNull();
    expect(baseName('a/b/file.json')).toBe('file.json');
  });

  it('builds move and type-aware rename paths', () => {
    expect(movePath('a/file.json', 'b/c')).toBe('b/c/file.json');
    expect(movePath('a/file.json', null)).toBe('file.json');
    expect(renamePath(file('a/old.json', 'diagram'), 'new')).toBe('a/new.json');
    expect(renamePath(file('old.md', 'markdown'), 'new')).toBe('new.md');
    expect(renamePath(file('a/photo.png', 'file'), 'renamed.png')).toBe('a/renamed.png');
  });

  it('builds a sorted nested folder tree', () => {
    const tree = buildContentFolderTree([
      { path: 'b/c', name: 'c', files: [] },
      { path: 'a', name: 'a', files: [] },
      { path: 'b', name: 'b', files: [] }
    ]);
    expect(tree.map(node => node.path)).toEqual(['a', 'b']);
    expect(tree[1]?.children.map(node => node.path)).toEqual(['b/c']);
  });
});

describe('new markdown document paths', () => {
  it('places the document in the folder, or the root', () => {
    expect(markdownDocumentPath('Notes', null)).toBe('Notes.md');
    expect(markdownDocumentPath('Notes', 'a/b')).toBe('a/b/Notes.md');
  });

  it('finds files in the root and in folders', () => {
    const tree = {
      rootFiles: [file('Root.md', 'markdown')],
      folders: [{ files: [file('a/Inside.md', 'markdown')] }]
    };
    expect(isContentPathTaken(tree, 'Root.md')).toBe(true);
    expect(isContentPathTaken(tree, 'a/Inside.md')).toBe(true);
    expect(isContentPathTaken(tree, 'Inside.md')).toBe(false);
    expect(isContentPathTaken(tree, 'a/Other.md')).toBe(false);
  });
});
