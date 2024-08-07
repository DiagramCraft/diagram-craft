import { describe, expect, it } from 'vitest';
import { makeMemo } from './memoize';

describe('makeMemo', () => {
  it('returns the computed value on first call', () => {
    const memoized = makeMemo<number>();
    const result = memoized(() => 42);
    expect(result).toBe(42);
  });

  it('returns the cached value on subsequent calls', () => {
    const memoized = makeMemo<number>();
    memoized(() => 42);
    const result = memoized(() => 100);
    expect(result).toBe(42);
  });

  it('handles undefined as a valid cached value', () => {
    const memoized = makeMemo<undefined>();
    const result = memoized(() => undefined);
    expect(result).toBeUndefined();
  });

  it('handles null as a valid cached value', () => {
    const memoized = makeMemo<null>();
    const result = memoized(() => null);
    expect(result).toBeNull();
  });

  it('works with different types', () => {
    const memoizedString = makeMemo<string>();
    const resultString = memoizedString(() => 'hello');
    expect(resultString).toBe('hello');

    const memoizedObject = makeMemo<{ a: number }>();
    const resultObject = memoizedObject(() => ({ a: 1 }));
    expect(resultObject).toEqual({ a: 1 });
  });
});
