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
});