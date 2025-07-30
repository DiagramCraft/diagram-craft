import { describe, expect, it } from 'vitest';
import { withDebug, isDebug } from './debug';

describe('debug', () => {
  it('isDebug should return false by default', () => {
    expect(isDebug()).toBe(false);
  });

  it('withDebug should set debug flag to true during execution', () => {
    expect(isDebug()).toBe(false);

    withDebug(() => {
      expect(isDebug()).toBe(true);
    });

    expect(isDebug()).toBe(false);
  });

  it('withDebug should return the result of the provided function', () => {
    const result = withDebug(() => 'test result');
    expect(result).toBe('test result');
  });

  it('withDebug should reset debug flag even if an error occurs', () => {
    expect(isDebug()).toBe(false);

    try {
      withDebug(() => {
        expect(isDebug()).toBe(true);
        throw new Error('Test error');
      });
    } catch (error) {
      // Error is expected
    }

    expect(isDebug()).toBe(false);
  });
});
