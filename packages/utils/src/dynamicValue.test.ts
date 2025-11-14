import { describe, expect, it, vi } from 'vitest';
import { DynamicValue } from './dynamicValue';

describe('DynamicValue', () => {
  it('should execute the callback and return its result', () => {
    const callback = vi.fn().mockReturnValue(42);
    const dynamicValue = new DynamicValue(callback);

    const result = dynamicValue.get();

    expect(result).toBe(42);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute the callback each time get() is called', () => {
    let counter = 0;
    const callback = vi.fn(() => ++counter);
    const dynamicValue = new DynamicValue(callback);

    const result1 = dynamicValue.get();
    const result2 = dynamicValue.get();
    const result3 = dynamicValue.get();

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(result3).toBe(3);
    expect(callback).toHaveBeenCalledTimes(3);
  });
});
