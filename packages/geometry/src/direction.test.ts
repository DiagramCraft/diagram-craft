import { describe, expect, test } from 'vitest';
import { Direction } from './direction';

describe('Direction', () => {
  test('opposite', () => {
    expect(Direction.opposite('n')).toBe('s');
    expect(Direction.opposite('s')).toBe('n');
    expect(Direction.opposite('w')).toBe('e');
    expect(Direction.opposite('e')).toBe('w');
  });

  test('all', () => {
    expect(Direction.all()).toStrictEqual(['n', 's', 'w', 'e']);
  });
});
