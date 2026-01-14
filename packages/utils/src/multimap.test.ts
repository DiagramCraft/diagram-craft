import { describe, expect, test } from 'vitest';
import { MultiMap } from './multimap';

describe('MultiMap', () => {
  test('should add and get values', () => {
    const map = new MultiMap<string, number>();
    map.add('a', 1);
    map.add('a', 2);
    map.add('b', 3);

    expect(map.get('a')).toEqual([1, 2]);
    expect(map.get('b')).toEqual([3]);
    expect(map.get('c')).toEqual([]);
  });

  test('should remove values', () => {
    const map = new MultiMap<string, number>();
    map.add('a', 1);
    map.add('a', 2);

    map.remove('a', 1);
    expect(map.get('a')).toEqual([2]);

    map.remove('a', 2);
    expect(map.get('a')).toEqual([]);

    // Removing non-existent value should not throw
    map.remove('a', 3);
    map.remove('b', 1);
  });

  test('should check if key has values', () => {
    const map = new MultiMap<string, number>();
    expect(map.has('a')).toBe(false);

    map.add('a', 1);
    expect(map.has('a')).toBe(true);

    map.remove('a', 1);
    expect(map.has('a')).toBe(false);
  });

  test('should clear all entries', () => {
    const map = new MultiMap<string, number>();
    map.add('a', 1);
    map.add('a', 2);
    map.add('b', 3);

    map.clear();

    expect(map.get('a')).toEqual([]);
    expect(map.get('b')).toEqual([]);
    expect(map.has('a')).toBe(false);
    expect(map.has('b')).toBe(false);
  });

  test('should return iterator of keys', () => {
    const map = new MultiMap<string, number>();
    map.add('a', 1);
    map.add('b', 2);
    map.add('c', 3);

    const keys = Array.from(map.keys());
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  test('should return empty iterator for keys when map is empty', () => {
    const map = new MultiMap<string, number>();
    const keys = Array.from(map.keys());
    expect(keys).toEqual([]);
  });

  test('should return iterator of entries', () => {
    const map = new MultiMap<string, number>();
    map.add('a', 1);
    map.add('a', 2);
    map.add('b', 3);

    const entries = Array.from(map.entries());
    expect(entries).toEqual([
      ['a', [1, 2]],
      ['b', [3]]
    ]);
  });

  test('should return empty iterator for entries when map is empty', () => {
    const map = new MultiMap<string, number>();
    const entries = Array.from(map.entries());
    expect(entries).toEqual([]);
  });
});
