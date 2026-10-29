import { describe, expect, it } from 'vitest';
import { normalizeEntityGraphDepth, normalizeEntityGraphDirection } from './types';

describe('EntityGraph props', () => {
  it('defaults and clamps depth to the supported range', () => {
    expect(normalizeEntityGraphDepth(undefined)).toBe(1);
    expect(normalizeEntityGraphDepth('0')).toBe(1);
    expect(normalizeEntityGraphDepth('2.8')).toBe(2);
    expect(normalizeEntityGraphDepth('99')).toBe(3);
    expect(normalizeEntityGraphDepth('not-a-number')).toBe(1);
  });

  it('normalizes direction values', () => {
    expect(normalizeEntityGraphDirection('UPSTREAM')).toBe('upstream');
    expect(normalizeEntityGraphDirection('downstream')).toBe('downstream');
    expect(normalizeEntityGraphDirection('unknown')).toBe('both');
  });
});
