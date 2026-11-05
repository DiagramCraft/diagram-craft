import { describe, expect, test } from 'vitest';
import { moveItem, reconcileKeys, removeAt, replaceAt, updateAt } from './listEditorOps';

describe('listEditorOps', () => {
  test('updateAt merges the patch into only the targeted item', () => {
    const items = [
      { a: 1, b: 1 },
      { a: 2, b: 2 }
    ];
    expect(updateAt(items, 1, { b: 9 })).toEqual([
      { a: 1, b: 1 },
      { a: 2, b: 9 }
    ]);
    expect(items[1]?.b).toBe(2);
  });

  test('replaceAt swaps the targeted item', () => {
    expect(replaceAt([1, 2, 3], 1, 9)).toEqual([1, 9, 3]);
  });

  test('removeAt drops the targeted item', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  test('moveItem moves forwards and backwards', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  test('moveItem ignores no-op and out of range moves', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 0)).toBe(items);
    expect(moveItem(items, 0, 2)).toBe(items);
  });

  test('reconcileKeys keeps existing keys, truncates and extends', () => {
    let n = 0;
    const make = () => `n${n++}`;
    const keys = ['k0', 'k1'];
    expect(reconcileKeys(keys, 2, make)).toBe(keys);
    expect(reconcileKeys(keys, 1, make)).toEqual(['k0']);
    expect(reconcileKeys(keys, 4, make)).toEqual(['k0', 'k1', 'n0', 'n1']);
  });
});
