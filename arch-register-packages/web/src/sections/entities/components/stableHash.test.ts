import { describe, expect, it } from 'vitest';
import { stableHash } from './stableHash';

describe('stableHash', () => {
  it('is deterministic and distinguishes common inputs', () => {
    expect(stableHash('entity-1')).toBe(stableHash('entity-1'));
    expect(stableHash('entity-1')).not.toBe(stableHash('entity-2'));
  });

  it('returns an unsigned integer suitable for deterministic placement', () => {
    const hash = stableHash('test');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });
});
