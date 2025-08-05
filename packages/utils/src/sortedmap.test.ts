import { describe, expect, test } from 'vitest';
import { SortedMap } from './sortedmap';

describe('SortedMap', () => {
  test('should add and check existence of values', () => {
    const map = new SortedMap<string, number>();
    
    // Initially map is empty
    expect(map.has('a')).toBe(false);
    
    // Add values
    map.add('a', 1);
    map.add('b', 2);
    
    // Check existence
    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(true);
    expect(map.has('c')).toBe(false);
  });
  
  test('should update values for existing keys', () => {
    const map = new SortedMap<string, number>();
    
    map.add('a', 1);
    map.add('a', 10);
    
    // Convert entries to array to check values
    const entries = Array.from(map.entries());
    expect(entries).toEqual([['a', 10]]);
  });
  
  test('should maintain insertion order for keys', () => {
    const map = new SortedMap<string, number>();
    
    // Add keys in specific order
    map.add('b', 2);
    map.add('a', 1);
    map.add('d', 4);
    map.add('c', 3);
    
    // Keys should be returned in insertion order
    const keys = Array.from(map.keys());
    expect(keys).toEqual(['b', 'a', 'd', 'c']);
  });
  
  test('should maintain insertion order for entries', () => {
    const map = new SortedMap<string, number>();
    
    // Add entries in specific order
    map.add('b', 2);
    map.add('a', 1);
    map.add('d', 4);
    map.add('c', 3);
    
    // Entries should be returned in insertion order
    const entries = Array.from(map.entries());
    expect(entries).toEqual([
      ['b', 2],
      ['a', 1],
      ['d', 4],
      ['c', 3]
    ]);
  });
  
  test('should preserve order when updating existing keys', () => {
    const map = new SortedMap<string, number>();
    
    // Add entries
    map.add('a', 1);
    map.add('b', 2);
    map.add('c', 3);
    
    // Update middle entry
    map.add('b', 20);
    
    // Order should be preserved
    const entries = Array.from(map.entries());
    expect(entries).toEqual([
      ['a', 1],
      ['b', 20],
      ['c', 3]
    ]);
  });
});