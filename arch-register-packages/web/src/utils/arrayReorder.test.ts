import { describe, expect, it } from 'vitest';
import { moveInArray, moveWithinBucket } from './arrayReorder';

describe('moveInArray', () => {
  it('moves an item forward', () => {
    expect(moveInArray(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveInArray(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op when from equals to', () => {
    const items = ['a', 'b', 'c'];
    expect(moveInArray(items, 1, 1)).toBe(items);
  });

  it('is a no-op for out-of-range indices', () => {
    const items = ['a', 'b', 'c'];
    expect(moveInArray(items, -1, 1)).toBe(items);
    expect(moveInArray(items, 1, 3)).toBe(items);
  });

  it('handles a single-item array', () => {
    const items = ['a'];
    expect(moveInArray(items, 0, 0)).toBe(items);
  });
});

describe('moveWithinBucket', () => {
  type Item = { id: string; label: string };
  const all: Item[] = [
    { id: 'a', label: 'A' },
    { id: 'x', label: 'X (other bucket)' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'y', label: 'Y (other bucket)' }
  ];
  const bucketIds = ['a', 'b', 'c'];

  it('moves a bucket item forward while leaving other items in place', () => {
    const result = moveWithinBucket(all, bucketIds, 0, 2);
    expect(result.map(item => item.id)).toEqual(['b', 'x', 'c', 'a', 'y']);
  });

  it('moves a bucket item backward while leaving other items in place', () => {
    const result = moveWithinBucket(all, bucketIds, 2, 0);
    expect(result.map(item => item.id)).toEqual(['c', 'x', 'a', 'b', 'y']);
  });

  it('is a no-op when from equals to', () => {
    expect(moveWithinBucket(all, bucketIds, 1, 1)).toBe(all);
  });

  it('is a no-op for out-of-range indices', () => {
    expect(moveWithinBucket(all, bucketIds, -1, 1)).toBe(all);
    expect(moveWithinBucket(all, bucketIds, 1, 3)).toBe(all);
  });

  it('handles a single-item bucket', () => {
    expect(moveWithinBucket(all, ['b'], 0, 0)).toBe(all);
  });
});
