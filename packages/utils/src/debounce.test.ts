/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { debounce, debounceMicrotask } from './debounce';

describe('debounce', () => {
  it('should delay the execution of the function by the specified time', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 110));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call the function with the correct arguments', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2');
    await new Promise(resolve => setTimeout(resolve, 110));
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should only call the function once if invoked multiple times in delay period', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    await new Promise(resolve => setTimeout(resolve, 110));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should reset the timer if called again within the delay period', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    setTimeout(() => debouncedFn(), 90);

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retain the correct "this" context when executed', async () => {
    const mockFn = vi.fn(function (this: any) {
      expect(this.test).toBe('context');
    });
    const debouncedFn = debounce(mockFn.bind({ test: 'context' }), 100);

    debouncedFn();
    await new Promise(resolve => setTimeout(resolve, 110));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('debounceMicrotask', () => {
  it('should execute the function in the next microtask', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounceMicrotask(mockFn);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    // Wait for microtasks to complete
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call the function with the correct arguments', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounceMicrotask(mockFn);

    debouncedFn('arg1', 'arg2');
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should only call the function once if invoked multiple times in the same event loop', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounceMicrotask(mockFn);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should allow subsequent calls after the microtask has executed', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounceMicrotask(mockFn);

    debouncedFn();
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(1);

    debouncedFn();
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should retain the correct "this" context when executed', async () => {
    const context = { test: 'context' };
    const mockFn = vi.fn(function(this: any) {
      expect(this.test).toBe('context');
    });

    const debouncedFn = debounceMicrotask(mockFn.bind(context));

    debouncedFn();
    await Promise.resolve();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
