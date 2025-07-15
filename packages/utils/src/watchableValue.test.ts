import { describe, it, expect, vi } from 'vitest';
import { WatchableValue } from './watchableValue';

describe('WatchableValue', () => {
  it('should initialize with the provided value', () => {
    const watchable = new WatchableValue(42);
    expect(watchable.get()).toBe(42);
  });

  it('should return the updated value after calling set()', () => {
    const watchable = new WatchableValue(10);
    watchable.set(20);
    expect(watchable.get()).toBe(20);
  });

  it('should emit a change event when the value is updated', () => {
    const watchable = new WatchableValue('initial');
    const changeListener = vi.fn();
    watchable.on('change', changeListener);

    watchable.set('updated');
    expect(changeListener).toHaveBeenCalledWith({ newValue: 'updated' });
  });

  it('should not emit a change event if the value remains the same', () => {
    const watchable = new WatchableValue(true);
    const changeListener = vi.fn();
    watchable.on('change', changeListener);

    watchable.set(true);
    expect(changeListener).not.toHaveBeenCalled();
  });

  it('should handle different types of values correctly', () => {
    const watchable = new WatchableValue<number | null>(null);
    const changeListener = vi.fn();
    watchable.on('change', changeListener);

    watchable.set(100);
    expect(watchable.get()).toBe(100);
    expect(changeListener).toHaveBeenCalledWith({ newValue: 100 });

    watchable.set(null);
    expect(watchable.get()).toBe(null);
    expect(changeListener).toHaveBeenCalledWith({ newValue: null });
  });

  describe('from', () => {
    it('should create a WatchableValue with the computed initial value', () => {
      const a = new WatchableValue(3);
      const b = new WatchableValue(4);

      const sum = WatchableValue.from(
        args => args.reduce((acc, val) => acc + val.get(), 0),
        [a, b]
      );

      expect(sum.get()).toBe(7);
    });

    it('should update the computed value when one of the dependencies changes', () => {
      const a = new WatchableValue(3);
      const b = new WatchableValue(4);

      const sum = WatchableValue.from(
        args => args.reduce((acc, val) => acc + val.get(), 0),
        [a, b]
      );

      a.set(5);
      expect(sum.get()).toBe(9);

      b.set(6);
      expect(sum.get()).toBe(11);
    });

    it('should emit a change event only when the computed value changes', () => {
      const a = new WatchableValue(2);
      const b = new WatchableValue(3);

      const sum = WatchableValue.from(
        args => args.reduce((acc, val) => acc + val.get(), 0),
        [a, b]
      );

      const changeListener = vi.fn();
      sum.on('change', changeListener);

      a.set(2); // No change in sum value
      expect(changeListener).not.toHaveBeenCalled();

      b.set(5); // Sum changes
      expect(changeListener).toHaveBeenCalledWith({ newValue: 7 });
    });

    it('should handle multiple dependencies correctly', () => {
      const a = new WatchableValue(1);
      const b = new WatchableValue(2);
      const c = new WatchableValue(3);

      const product = WatchableValue.from(
        args => args.reduce((acc, val) => acc * val.get(), 1),
        [a, b, c]
      );

      expect(product.get()).toBe(6);

      c.set(4);
      expect(product.get()).toBe(8);
    });
  });
});
