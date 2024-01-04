import { describe, expect, test } from 'vitest';
import { Line } from './line.ts';

describe('Line', () => {
  test('extend', () => {
    expect(Line.extend(Line.of({ x: 0, y: 0 }, { x: 10, y: 0 }), 10, 10)).toStrictEqual(
      Line.of({ x: -10, y: 0 }, { x: 20, y: 0 })
    );
  });

  test('vertical', () => {
    expect(Line.vertical(10, [0, 10])).toStrictEqual(Line.of({ x: 10, y: 0 }, { x: 10, y: 10 }));
  });

  test('horizontal', () => {
    expect(Line.horizontal(10, [0, 10])).toStrictEqual(Line.of({ x: 0, y: 10 }, { x: 10, y: 10 }));
  });

  test('of', () => {
    expect(Line.of({ x: 0, y: 0 }, { x: 10, y: 0 })).toStrictEqual({
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 }
    });
  });

  test('midpoint', () => {
    expect(Line.midpoint(Line.of({ x: 0, y: 0 }, { x: 10, y: 0 }))).toStrictEqual({ x: 5, y: 0 });
  });

  test('move', () => {
    const source = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
    const expected = Line.of({ x: 10, y: 10 }, { x: 20, y: 10 });

    expect(Line.move(source, { x: 10, y: 10 })).toStrictEqual(expected);
  });

  test('isHorizontal', () => {
    expect(Line.isHorizontal(Line.of({ x: 0, y: 0 }, { x: 10, y: 0 }))).toBe(true);
    expect(Line.isHorizontal(Line.of({ x: 0, y: 0 }, { x: 10, y: 10 }))).toBe(false);
  });

  test('intersection', () => {
    expect(
      Line.intersection(
        Line.of({ x: 0, y: 0 }, { x: 10, y: 0 }),
        Line.of({ x: 5, y: -5 }, { x: 5, y: 5 })
      )
    ).toStrictEqual({ x: 5, y: 0 });
  });
});
