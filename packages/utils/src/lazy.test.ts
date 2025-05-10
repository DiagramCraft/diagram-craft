// lazy.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Lazy } from './lazy';

describe('Lazy', () => {
  it('should compute the value only upon the first access', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    expect(computeFn).not.toHaveBeenCalled();
    expect(lazy.get()).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should return the cached value on subsequent accesses', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    expect(lazy.get()).toBe(42);
    expect(lazy.get()).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should recompute the value after being cleared', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    expect(lazy.get()).toBe(42);
    lazy.clear();
    expect(lazy.get()).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it('should return false initially when hasValue is called', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    expect(lazy.hasValue()).toBe(false);
  });

  it('should return true after the value is computed and cached', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    lazy.get();
    expect(lazy.hasValue()).toBe(true);
  });

  it('should return false after the cached value is cleared', () => {
    const computeFn = vi.fn(() => 42);
    const lazy = new Lazy(computeFn);

    lazy.get();
    lazy.clear();
    expect(lazy.hasValue()).toBe(false);
  });
});
