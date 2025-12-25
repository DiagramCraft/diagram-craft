import { describe, expect, test } from 'vitest';
import { isStencil, parseStencilString } from './drawioStencilUtils';

describe('isStencil', () => {
  test('returns true for stencil string', () => {
    expect(isStencil('stencil(abc123)')).toBe(true);
  });

  test('returns true for stencil with complex data', () => {
    expect(
      isStencil(
        'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
      )
    ).toBe(true);
  });

  test('returns false for non-stencil string', () => {
    expect(isStencil('rect')).toBe(false);
  });

  test('returns undefined for undefined', () => {
    expect(isStencil(undefined)).toBeUndefined();
  });

  test('returns false for empty string', () => {
    expect(isStencil('')).toBe(false);
  });

  test('returns false for string starting with stencil but not stencil(', () => {
    expect(isStencil('stencilShape')).toBe(false);
  });
});

describe('parseStencilString', () => {
  test('returns undefined for undefined input', () => {
    expect(parseStencilString(undefined)).toBeUndefined();
  });

  test('extracts content from valid stencil format', () => {
    const stencilData = 'eNqLjgUAARUAuQ==';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });

  test('extracts complex stencil data', () => {
    const stencilData =
      'tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });

  test('handles stencil with special characters', () => {
    const stencilData = 'abc123+/=';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });
});
