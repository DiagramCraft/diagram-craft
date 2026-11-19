import { describe, expect, test } from 'vitest';
import { flattenTree, type TreeItemLike } from './treeFlatten';

type Item = TreeItemLike<{ name: string }>;

const node = (id: string, children: Item[] = []): Item => ({ _uid: id, name: id, children });

const TREE = [node('a', [node('a1', [node('a1x')]), node('a2')]), node('b')];

describe('flattenTree', () => {
  test('lists nodes depth-first in tree order with depth', () => {
    const rows = flattenTree(TREE, new Set());
    expect(rows.map(r => [r.item._uid, r.depth])).toEqual([
      ['a', 0],
      ['a1', 1],
      ['a1x', 2],
      ['a2', 1],
      ['b', 0]
    ]);
  });

  test('hides descendants of collapsed nodes', () => {
    const rows = flattenTree(TREE, new Set(['a1']));
    expect(rows.map(r => r.item._uid)).toEqual(['a', 'a1', 'a2', 'b']);
    expect(rows.find(r => r.item._uid === 'a1')).toMatchObject({
      hasChildren: true,
      expanded: false
    });
  });

  test('collapsing a root hides its whole branch only', () => {
    expect(flattenTree(TREE, new Set(['a'])).map(r => r.item._uid)).toEqual(['a', 'b']);
  });

  test('leaves report no children', () => {
    expect(flattenTree(TREE, new Set()).find(r => r.item._uid === 'b')?.hasChildren).toBe(false);
  });
});
