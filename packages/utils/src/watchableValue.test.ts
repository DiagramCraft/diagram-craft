import {describe, expect, it, vi} from 'vitest';
import {WatchableValue} from './watchableValue';

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
    expect(changeListener).toHaveBeenCalledWith({newValue: 'updated'});
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
    expect(changeListener).toHaveBeenCalledWith({newValue: 100});

    watchable.set(null);
    expect(watchable.get()).toBe(null);
    expect(changeListener).toHaveBeenCalledWith({newValue: null});
  });
});