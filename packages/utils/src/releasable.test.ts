import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Releasable, Releasables, TimerReleasable } from './releasable';

describe('TimerReleasable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setTimeout', () => {
    test('should clear timeout when released', () => {
      const callback = vi.fn();
      const timerId = setTimeout(callback, 1000) as any;
      const releasable = new TimerReleasable(timerId, false);

      releasable.release();
      vi.runAllTimers();

      expect(callback).not.toHaveBeenCalled();
    });

    test('should be idempotent - calling release multiple times should be safe', () => {
      const callback = vi.fn();
      const timerId = setTimeout(callback, 1000) as any;
      const releasable = new TimerReleasable(timerId, false);

      releasable.release();
      releasable.release();
      releasable.release();
      vi.runAllTimers();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setInterval', () => {
    test('should clear interval when released', () => {
      const callback = vi.fn();
      const timerId = setInterval(callback, 100) as any;
      const releasable = new TimerReleasable(timerId, true);

      releasable.release();
      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();
    });

    test('should be idempotent - calling release multiple times should be safe', () => {
      const callback = vi.fn();
      const timerId = setInterval(callback, 100) as any;
      const releasable = new TimerReleasable(timerId, true);

      releasable.release();
      releasable.release();
      releasable.release();
      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();
    });

    test('should clear interval that has already fired', () => {
      const callback = vi.fn();
      const timerId = setInterval(callback, 100) as any;
      const releasable = new TimerReleasable(timerId, true);

      vi.advanceTimersByTime(250);
      expect(callback).toHaveBeenCalledTimes(2);

      releasable.release();
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Releasables', () => {
  test('should release all added releasables', () => {
    const releasables = new Releasables();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const cleanup3 = vi.fn();

    releasables.add(cleanup1);
    releasables.add(cleanup2);
    releasables.add(cleanup3);

    releasables.release();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
  });

  test('should release objects implementing Releasable interface', () => {
    const releasables = new Releasables();
    const mockReleasable: Releasable = {
      release: vi.fn()
    };

    releasables.add(mockReleasable);
    releasables.release();

    expect(mockReleasable.release).toHaveBeenCalledTimes(1);
  });

  test('should handle mix of functions and Releasable objects', () => {
    const releasables = new Releasables();
    const cleanup = vi.fn();
    const mockReleasable: Releasable = {
      release: vi.fn()
    };

    releasables.add(cleanup);
    releasables.add(mockReleasable);

    releasables.release();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(mockReleasable.release).toHaveBeenCalledTimes(1);
  });

  test('should be idempotent - calling release multiple times should not call cleanups again', () => {
    const releasables = new Releasables();
    const cleanup = vi.fn();

    releasables.add(cleanup);

    releasables.release();
    releasables.release();
    releasables.release();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('should immediately release items added after release has been called', () => {
    const releasables = new Releasables();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    releasables.add(cleanup1);
    releasables.release();

    expect(cleanup1).toHaveBeenCalledTimes(1);

    releasables.add(cleanup2);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  test('should handle errors in cleanup functions without stopping other cleanups', () => {
    const releasables = new Releasables();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn(() => {
      throw new Error('Cleanup error');
    });
    const cleanup3 = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    releasables.add(cleanup1);
    releasables.add(cleanup2);
    releasables.add(cleanup3);

    releasables.release();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  test('should handle errors in Releasable objects without stopping other cleanups', () => {
    const releasables = new Releasables();
    const mockReleasable1: Releasable = {
      release: vi.fn()
    };
    const mockReleasable2: Releasable = {
      release: vi.fn(() => {
        throw new Error('Release error');
      })
    };
    const mockReleasable3: Releasable = {
      release: vi.fn()
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    releasables.add(mockReleasable1);
    releasables.add(mockReleasable2);
    releasables.add(mockReleasable3);

    releasables.release();

    expect(mockReleasable1.release).toHaveBeenCalledTimes(1);
    expect(mockReleasable2.release).toHaveBeenCalledTimes(1);
    expect(mockReleasable3.release).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  test('should clear internal array after release', () => {
    const releasables = new Releasables();
    const cleanup = vi.fn();

    releasables.add(cleanup);
    releasables.release();

    expect(cleanup).toHaveBeenCalledTimes(1);

    cleanup.mockClear();
    releasables.release();

    expect(cleanup).not.toHaveBeenCalled();
  });

  test('should handle empty collection', () => {
    const releasables = new Releasables();
    expect(() => releasables.release()).not.toThrow();
  });

  test('should integrate with TimerReleasable', () => {
    vi.useFakeTimers();
    const releasables = new Releasables();
    const callback = vi.fn();
    const timerId = setInterval(callback, 100) as any;
    const timerReleasable = new TimerReleasable(timerId, true);

    releasables.add(timerReleasable);

    vi.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(2);

    releasables.release();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });
});
