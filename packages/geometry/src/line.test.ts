import { describe, expect, test } from 'vitest';
import { Line } from './line';
import { Point } from './point';
import { Axis } from './axis';

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

  describe('intersection', () => {
    const horizontal = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });

    test('finds an intersection within both segments', () => {
      expect(Line.intersection(horizontal, Line.of({ x: 5, y: -5 }, { x: 5, y: 5 }))).toStrictEqual(
        {
          x: 5,
          y: 0
        }
      );
    });

    test('returns an intersection at a shared endpoint', () => {
      expect(
        Line.intersection(horizontal, Line.of({ x: 10, y: -5 }, { x: 10, y: 5 }))
      ).toStrictEqual({
        x: 10,
        y: 0
      });
    });

    test('returns undefined when segments do not reach the intersection', () => {
      expect(
        Line.intersection(horizontal, Line.of({ x: 15, y: -5 }, { x: 15, y: -1 }))
      ).toBeUndefined();
    });

    test('finds intersections outside the segments when extended', () => {
      expect(
        Line.intersection(horizontal, Line.of({ x: 15, y: -5 }, { x: 15, y: -1 }), true)
      ).toStrictEqual({
        x: 15,
        y: 0
      });
    });

    test('returns undefined for parallel lines when extended', () => {
      expect(
        Line.intersection(horizontal, Line.of({ x: 0, y: 1 }, { x: 10, y: 1 }), true)
      ).toBeUndefined();
      expect(Line.intersection(horizontal, horizontal, true)).toBeUndefined();
    });
  });

  describe('projectPoint', () => {
    const line = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });

    test('projects onto the segment', () => {
      expect(Line.projectPoint(line, { x: 5, y: 4 })).toStrictEqual({ x: 5, y: 0 });
    });

    test('clamps projections to the segment endpoints', () => {
      expect(Line.projectPoint(line, { x: -5, y: 4 })).toStrictEqual(line.from);
      expect(Line.projectPoint(line, { x: 15, y: 4 })).toStrictEqual(line.to);
    });
  });

  describe('isOn', () => {
    const line = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });

    test('returns true for a point on the segment', () => {
      expect(Line.isOn({ x: 5, y: 0 }, line)).toBe(true);
    });

    test('returns false for a point away from the segment', () => {
      expect(Line.isOn({ x: 5, y: 1 }, line)).toBe(false);
      expect(Line.isOn({ x: 15, y: 0 }, line)).toBe(false);
    });
  });

  describe('isVertical', () => {
    test('returns true for a vertical line and false for a diagonal line', () => {
      expect(Line.isVertical(Line.of({ x: 5, y: 0 }, { x: 5, y: 10 }))).toBe(true);
      expect(Line.isVertical(Line.of({ x: 0, y: 0 }, { x: 10, y: 10 }))).toBe(false);
    });
  });

  describe('length', () => {
    test('calculates length of horizontal line correctly', () => {
      const line = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      expect(Line.length(line)).toBeCloseTo(10);
    });

    test('calculates length of vertical line correctly', () => {
      const line = Line.of({ x: 0, y: 0 }, { x: 0, y: 10 });
      expect(Line.length(line)).toBeCloseTo(10);
    });

    test('calculates length of diagonal line correctly', () => {
      const line = Line.of({ x: 0, y: 0 }, { x: 10, y: 10 });
      expect(Line.length(line)).toBeCloseTo(Math.sqrt(200));
    });

    test('returns zero for line of zero length', () => {
      const line = Line.of({ x: 0, y: 0 }, { x: 0, y: 0 });
      expect(Line.length(line)).toBe(0);
    });
  });

  describe('orthogonalDistance', () => {
    test('should calculate horizontal distance for vertical lines', () => {
      // Two vertical lines at x=10 and x=20
      const line1 = Line.of({ x: 10, y: 0 }, { x: 10, y: 100 });
      const line2 = Line.of({ x: 20, y: 50 }, { x: 20, y: 150 });

      // Distance along X-axis (orthogonal to vertical lines)
      expect(Line.orthogonalDistance(line1, line2, Axis.h)).toBe(-10); // 10 - 20 = -10
      expect(Line.orthogonalDistance(line2, line1, Axis.h)).toBe(10); // 20 - 10 = 10
    });

    test('should calculate vertical distance for horizontal lines', () => {
      // Two horizontal lines at y=5 and y=15
      const line1 = Line.of({ x: 0, y: 5 }, { x: 100, y: 5 });
      const line2 = Line.of({ x: 50, y: 15 }, { x: 150, y: 15 });

      // Distance along Y-axis (orthogonal to horizontal lines)
      expect(Line.orthogonalDistance(line1, line2, Axis.v)).toBe(-10); // 5 - 15 = -10
      expect(Line.orthogonalDistance(line2, line1, Axis.v)).toBe(10); // 15 - 5 = 10
    });
  });

  describe('overlap', () => {
    // Helper to create lines and check equality accounting for floating-point issues
    const assertLinesEqual = (actual: Line | undefined, expected: Line | undefined) => {
      if (expected === undefined) {
        expect(actual).toBeUndefined();
        return;
      }

      expect(actual).toBeDefined();
      if (actual) {
        expect(Point.isEqual(actual.from, expected.from)).toBe(true);
        expect(Point.isEqual(actual.to, expected.to)).toBe(true);
      }
    };

    test('should return undefined for non-collinear lines', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 5, y: 5 }, { x: 15, y: 5 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should return undefined for collinear non-overlapping lines', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 5, y: 0 });
      const l2 = Line.of({ x: 10, y: 0 }, { x: 15, y: 0 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should return the overlapping segment when lines partially overlap', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 5, y: 0 }, { x: 15, y: 0 });

      const expected = Line.of({ x: 5, y: 0 }, { x: 10, y: 0 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should correctly handle when one line is contained entirely within the other', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 20, y: 0 });
      const l2 = Line.of({ x: 5, y: 0 }, { x: 15, y: 0 });

      const expected = Line.of({ x: 5, y: 0 }, { x: 15, y: 0 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should correctly handle when lines share an endpoint', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 10, y: 0 }, { x: 20, y: 0 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should work for vertical lines', () => {
      const l1 = Line.of({ x: 5, y: 0 }, { x: 5, y: 10 });
      const l2 = Line.of({ x: 5, y: 5 }, { x: 5, y: 15 });

      const expected = Line.of({ x: 5, y: 5 }, { x: 5, y: 10 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should work for diagonal lines', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 10 });
      const l2 = Line.of({ x: 5, y: 5 }, { x: 15, y: 15 });

      const expected = Line.of({ x: 5, y: 5 }, { x: 10, y: 10 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should not report short separated parallel lines as overlapping', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 0.001, y: 0 });
      const l2 = Line.of({ x: 0, y: 1 }, { x: 0.001, y: 1 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should find overlap between short collinear lines', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 0.003, y: 0 });
      const l2 = Line.of({ x: 0.001, y: 0 }, { x: 0.004, y: 0 });

      const expected = Line.of({ x: 0.001, y: 0 }, { x: 0.003, y: 0 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should handle identical lines', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 10 });
      const l2 = Line.of({ x: 0, y: 0 }, { x: 10, y: 10 });

      const expected = Line.of({ x: 0, y: 0 }, { x: 10, y: 10 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should handle lines in reverse direction', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 15, y: 0 }, { x: 5, y: 0 });

      const expected = Line.of({ x: 5, y: 0 }, { x: 10, y: 0 });
      assertLinesEqual(Line.overlap(l1, l2), expected);
    });

    test('should handle zero-length lines at the same point', () => {
      const l1 = Line.of({ x: 5, y: 5 }, { x: 5, y: 5 });
      const l2 = Line.of({ x: 5, y: 5 }, { x: 5, y: 5 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should handle zero-length line overlapping with a regular line', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 5, y: 0 }, { x: 5, y: 0 });

      expect(Line.overlap(l1, l2)).toBeUndefined();
    });

    test('should be commutative - order of lines should not matter', () => {
      const l1 = Line.of({ x: 0, y: 0 }, { x: 10, y: 0 });
      const l2 = Line.of({ x: 5, y: 0 }, { x: 15, y: 0 });

      const overlap1 = Line.overlap(l1, l2);
      const overlap2 = Line.overlap(l2, l1);

      expect(overlap1).toBeDefined();
      expect(overlap2).toBeDefined();

      if (overlap1 && overlap2) {
        expect(Point.isEqual(overlap1.from, overlap2.from)).toBe(true);
        expect(Point.isEqual(overlap1.to, overlap2.to)).toBe(true);
      }
    });
  });
});
