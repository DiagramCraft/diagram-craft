import { describe, expect, test } from 'vitest';
import { moveColumn } from './useColumnLayout';

describe('moveColumn', () => {
  const order = ['a', 'b', 'c'];

  test('moves a column up and down', () => {
    expect(moveColumn(order, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveColumn(order, 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  test('clamps at the bounds', () => {
    expect(moveColumn(order, 'a', -1)).toBe(order);
    expect(moveColumn(order, 'c', 1)).toBe(order);
  });

  test('ignores unknown ids', () => {
    expect(moveColumn(order, 'x', 1)).toBe(order);
  });
});
