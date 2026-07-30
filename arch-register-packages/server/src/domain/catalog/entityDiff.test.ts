import { describe, expect, it } from 'vitest';
import { buildDiff, equalEntityValue } from './entityDiff';

describe('buildDiff', () => {
  it('reports mutable built-in and custom data changes while ignoring metadata', () => {
    expect(
      buildDiff(
        {
          name: 'Before',
          data: { owner_count: 1, unchanged: 'same' },
          updated_at: '2026-01-01T00:00:00.000Z',
          version: 1
        },
        {
          name: 'After',
          data: { owner_count: 2, unchanged: 'same' },
          updated_at: '2026-01-02T00:00:00.000Z',
          version: 2
        }
      )
    ).toEqual({
      name: { before: 'Before', after: 'After' },
      data: {
        before: { owner_count: 1, unchanged: 'same' },
        after: { owner_count: 2, unchanged: 'same' }
      }
    });
  });

  it('preserves the existing null representation for missing values', () => {
    expect(equalEntityValue(undefined, null)).toBe(false);
    expect(buildDiff({ owner: undefined }, { owner: null })).toEqual({
      owner: { before: null, after: null }
    });
  });

  it('sorts object keys for stable comparisons but preserves array order', () => {
    expect(equalEntityValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(equalEntityValue(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
