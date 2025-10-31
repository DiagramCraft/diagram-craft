import { describe, expect, test } from 'vitest';
import { Axis } from './axis';

describe('Axis', () => {
  test('orthogonal', () => {
    expect(Axis.orthogonal('h')).toBe('v');
    expect(Axis.orthogonal('v')).toBe('h');
  });

  test('toXY', () => {
    expect(Axis.toXY('h')).toBe('x');
    expect(Axis.toXY('v')).toBe('y');
  });

  test('axises', () => {
    expect(Axis.axes()).toStrictEqual(['h', 'v']);
  });
});
