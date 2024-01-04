import { describe, expect, test } from 'vitest';
import { Axis } from './axis.ts';

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
    expect(Axis.axises()).toStrictEqual(['h', 'v']);
  });
});
