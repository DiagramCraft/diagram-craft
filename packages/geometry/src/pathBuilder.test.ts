import { describe, expect, test } from 'vitest';
import { inverseUnitCoordinateSystem, unitCoordinateSystem } from './pathBuilder';

describe('unitCoordinateSystem', () => {
  test('all', () => {
    const c = unitCoordinateSystem({ x: -10, y: -20, w: 30, h: 50, r: 0 });
    expect(c({ x: 0, y: 0 })).toEqual({ x: 5, y: 5 });
    expect(c({ x: -1, y: -1 })).toEqual({ x: -10, y: 30 });
    expect(c({ x: 1, y: 1 })).toEqual({ x: 20, y: -20 });
  });
});

describe('inverseUnitCoordinateSystem', () => {
  test('all', () => {
    const c = inverseUnitCoordinateSystem({ x: -10, y: -20, w: 30, h: 50, r: 0 });
    expect(c({ x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
    expect(c({ x: -10, y: 30 })).toEqual({ x: -1, y: -1 });
    expect(c({ x: 20, y: -20 })).toEqual({ x: 1, y: 1 });
  });
});
