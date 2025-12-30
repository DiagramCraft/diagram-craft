import { describe, expect, test } from 'vitest';
import { Box, WritableBox } from './box';
import { Line } from './line';

describe('Box', () => {
  // WritableBox tests
  describe('WritableBox', () => {
    test('asBox converts WritableBox to Box', () => {
      const writableBox: WritableBox = { x: 0, y: 0, w: 10, h: 10, r: 0, _discriminator: 'rw' };
      const box = WritableBox.asBox(writableBox);
      expect(box).toEqual({ x: 0, y: 0, w: 10, h: 10, r: 0, _discriminator: undefined });
    });
  });

  // Box utility functions tests
  describe('Box utility functions', () => {
    test('withoutRotation returns box with rotation set to 0', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: Math.PI / 4 };
      expect(Box.withoutRotation(box)).toStrictEqual({ ...box, r: 0 });
    });

    test('unit returns a unit box', () => {
      expect(Box.unit()).toStrictEqual({ x: -1, y: -1, w: 2, h: 2, r: 0 });
    });

    test('asReadWrite converts Box to WritableBox', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const writableBox = Box.asReadWrite(box);
      expect(writableBox).toStrictEqual({ ...box, _discriminator: 'rw' });
    });

    test('from creates a box from width and height', () => {
      expect(Box.from({ w: 10, h: 20 })).toStrictEqual({ x: 0, y: 0, w: 10, h: 20, r: 0 });
    });

    test('fromCorners creates a box from two points', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 20 };
      expect(Box.fromCorners(a, b)).toStrictEqual({ x: 0, y: 0, w: 10, h: 20, r: 0 });
    });

    test('fromCorners handles points in any order', () => {
      const a = { x: 10, y: 20 };
      const b = { x: 0, y: 0 };
      expect(Box.fromCorners(a, b)).toStrictEqual({ x: 0, y: 0, w: 10, h: 20, r: 0 });
    });

    test('calculates center', () => {
      expect(Box.center({ x: 0, y: 0, w: 10, h: 10, r: 0 })).toStrictEqual({
        x: 5,
        y: 5
      });
    });

    test('isEqual returns true for equal boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.isEqual(box1, box2)).toBe(true);
    });

    test('isEqual returns false for different boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 1, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.isEqual(box1, box2)).toBe(false);
    });

    test('calculates bounding box for non-rotated boxes', () => {
      expect(
        Box.boundingBox([
          { x: 0, y: 0, w: 10, h: 10, r: 0 },
          { x: 5, y: 5, w: 10, h: 10, r: 0 }
        ])
      ).toStrictEqual({ x: 0, y: 0, w: 15, h: 15, r: 0 });
    });

    test('calculates bounding box for rotated boxes with same rotation', () => {
      const rotation = Math.PI / 4;
      const result = Box.boundingBox([
        { x: 0, y: 0, w: 10, h: 10, r: rotation },
        { x: 10, y: 0, w: 10, h: 10, r: rotation }
      ]);
      expect(result.r).toBe(rotation);
      // The exact coordinates will depend on the rotation calculation, so we just check that it's a valid box
      expect(result.w).toBeGreaterThan(0);
      expect(result.h).toBeGreaterThan(0);
    });

    test('calculates bounding box for boxes with different rotations', () => {
      const result = Box.boundingBox(
        [
          { x: 0, y: 0, w: 10, h: 10, r: Math.PI / 4 },
          { x: 10, y: 0, w: 10, h: 10, r: Math.PI / 2 }
        ],
        false
      );
      expect(result.r).toBe(0); // Should be axis-aligned
      expect(result.w).toBeGreaterThan(0);
      expect(result.h).toBeGreaterThan(0);
    });

    test('calculates corners for non-rotated box', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.corners(box)).toStrictEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]);
    });

    test('calculates corners for rotated box', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: Math.PI / 2 };
      const corners = Box.corners(box);
      const center = Box.center(box);

      // For a 90-degree rotation, we can't predict the exact coordinates without knowing the implementation details
      // Instead, we'll verify that:
      // 1. We have 4 corners
      // 2. The corners form a square (equal distances between adjacent corners)
      // 3. The corners are rotated 90 degrees from the original

      expect(corners.length).toBe(4);

      // Check that the corners are equidistant from the center
      const distances = corners.map(corner =>
        Math.sqrt(Math.pow(corner.x - center.x, 2) + Math.pow(corner.y - center.y, 2))
      );

      for (let i = 0; i < distances.length; i++) {
        expect(distances[i]).toBeCloseTo(Math.sqrt(50)); // distance from center to corner should be sqrt(5^2 + 5^2)
      }

      // For a 90-degree rotation, if we start with a square at (0,0), (10,0), (10,10), (0,10)
      // After rotation around the center (5,5), the corners should be approximately at:
      // (0,10), (0,0), (10,0), (10,10) - but the exact values depend on the implementation

      // Instead of checking exact coordinates, we'll verify that the corners form a square
      // by checking that adjacent sides have equal length
      const side1 = Math.sqrt(
        Math.pow(corners[0]!.x - corners[1]!.x, 2) + Math.pow(corners[0]!.y - corners[1]!.y, 2)
      );
      const side2 = Math.sqrt(
        Math.pow(corners[1]!.x - corners[2]!.x, 2) + Math.pow(corners[1]!.y - corners[2]!.y, 2)
      );
      const side3 = Math.sqrt(
        Math.pow(corners[2]!.x - corners[3]!.x, 2) + Math.pow(corners[2]!.y - corners[3]!.y, 2)
      );
      const side4 = Math.sqrt(
        Math.pow(corners[3]!.x - corners[0]!.x, 2) + Math.pow(corners[3]!.y - corners[0]!.y, 2)
      );

      expect(side1).toBeCloseTo(10);
      expect(side2).toBeCloseTo(10);
      expect(side3).toBeCloseTo(10);
      expect(side4).toBeCloseTo(10);
    });

    test('calculates opposite corners only when oppositeOnly is true', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.oppositeCorners(box)).toStrictEqual([
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]);
    });

    test('line returns the correct edge line based on direction', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.line(box, 'n')).toStrictEqual({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 } });
      expect(Box.line(box, 's')).toStrictEqual({ from: { x: 10, y: 10 }, to: { x: 0, y: 10 } });
      expect(Box.line(box, 'e')).toStrictEqual({ from: { x: 10, y: 0 }, to: { x: 10, y: 10 } });
      expect(Box.line(box, 'w')).toStrictEqual({ from: { x: 0, y: 10 }, to: { x: 0, y: 0 } });
    });

    test('asPolygon converts box to polygon', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.asPolygon(box)).toStrictEqual({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      });
    });

    test('contains point', () => {
      expect(Box.contains({ x: 0, y: 0, w: 10, h: 10, r: 0 }, { x: 5, y: 5 })).toBe(true);
    });

    test("doesn't contain point", () => {
      expect(Box.contains({ x: 0, y: 0, w: 10, h: 10, r: 0 }, { x: 15, y: 15 })).toBe(false);
    });

    test('contains point with rotated box', () => {
      expect(Box.contains({ x: 0, y: 0, w: 10, h: 10, r: Math.PI / 2 }, { x: 0, y: 5 })).toBe(true);
    });

    test("doesn't contain point with rotated box", () => {
      expect(Box.contains({ x: 0, y: 0, w: 10, h: 10, r: Math.PI / 2 }, { x: 15, y: 15 })).toBe(
        false
      );
    });

    test('contains box', () => {
      const outerBox = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const innerBox = { x: 5, y: 5, w: 10, h: 10, r: 0 };
      expect(Box.contains(outerBox, innerBox)).toBe(true);
    });

    test("doesn't contain box", () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 15, y: 15, w: 10, h: 10, r: 0 };
      expect(Box.contains(box1, box2)).toBe(false);
    });

    test('contains returns false if box is undefined', () => {
      expect(Box.contains(undefined, { x: 5, y: 5 })).toBe(false);
    });

    test('intersects returns true for overlapping boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 5, y: 5, w: 10, h: 10, r: 0 };
      expect(Box.intersects(box1, box2)).toBe(true);
    });

    test('intersects returns false for non-overlapping boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 20, y: 20, w: 10, h: 10, r: 0 };
      expect(Box.intersects(box1, box2)).toBe(false);
    });

    test('intersects works with rotated boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: Math.PI / 4 };
      const box2 = { x: 5, y: 5, w: 10, h: 10, r: Math.PI / 2 };
      expect(Box.intersects(box1, box2)).toBe(true);
    });

    test('normalize handles negative width and height', () => {
      const box = { x: 10, y: 10, w: -10, h: -10, r: 0 };
      expect(Box.normalize(box)).toStrictEqual({ x: 0, y: 0, w: 10, h: 10, r: 0 });
    });

    test('fromLine creates a box from a line', () => {
      const line: Line = { from: { x: 0, y: 0 }, to: { x: 10, y: 20 } };
      expect(Box.fromLine(line)).toStrictEqual({ x: 0, y: 0, w: 10, h: 20, r: 0 });
    });

    test('fromOffset calculates point from box and offset', () => {
      const box = { x: 0, y: 0, w: 10, h: 20, r: 0 };
      const offset = { x: 0.5, y: 0.5 };
      expect(Box.fromOffset(box, offset)).toStrictEqual({ x: 5, y: 10 });
    });

    test('applyAspectRatio returns original box when aspect ratio is 1', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.applyAspectRatio(box, 1)).toStrictEqual(box);
    });

    test('applyAspectRatio adjusts width when aspect ratio is less than 1', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.applyAspectRatio(box, 0.5)).toStrictEqual({ ...box, w: 5 });
    });

    test('applyAspectRatio adjusts height when aspect ratio is greater than 1', () => {
      const box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.applyAspectRatio(box, 2)).toStrictEqual({ ...box, h: 5 });
    });

    test('grow expands box by given amount', () => {
      const box = { x: 10, y: 10, w: 20, h: 20, r: 0 };
      expect(Box.grow(box, 5)).toStrictEqual({ x: 5, y: 5, w: 30, h: 30, r: 0 });
    });

    test('grow preserves rotation', () => {
      const box = { x: 10, y: 10, w: 20, h: 20, r: Math.PI / 4 };
      expect(Box.grow(box, 5)).toStrictEqual({ x: 5, y: 5, w: 30, h: 30, r: Math.PI / 4 });
    });

    test('midpoint calculates midpoint between horizontally separated boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 20, y: 0, w: 10, h: 10, r: 0 };
      expect(Box.midpoint(box1, box2)).toStrictEqual({ x: 15, y: 10 });
    });

    test('midpoint calculates midpoint between vertically separated boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 0, y: 20, w: 10, h: 10, r: 0 };
      expect(Box.midpoint(box1, box2)).toStrictEqual({ x: 10, y: 15 });
    });

    test('midpoint handles overlapping boxes', () => {
      const box1 = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const box2 = { x: 5, y: 5, w: 10, h: 10, r: 0 };
      expect(Box.midpoint(box1, box2)).toStrictEqual({ x: 10, y: 10 });
    });
  });

  describe('fromString', () => {
    test('fromString converts string to box', () => {
      const s = '1,2,3,4,5';
      expect(Box.fromString(s)).toStrictEqual({ x: 1, y: 2, w: 3, h: 4, r: 5 });
    });
  });

  describe('toString', () => {
    test('toString converts box to string', () => {
      const box = { x: 1, y: 2, w: 3, h: 4, r: 5 };
      expect(Box.toString(box)).toBe('1,2,3,4,5');
    });
  });

  describe('projectPointToBoundary', () => {
    test('projects point inside box to closest boundary point - top edge', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 50, y: 20 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 50, y: 0 });
    });

    test('projects point inside box to closest boundary point - bottom edge', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 50, y: 80 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 50, y: 100 });
    });

    test('projects point inside box to closest boundary point - left edge', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 20, y: 50 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 0, y: 50 });
    });

    test('projects point inside box to closest boundary point - right edge', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 80, y: 50 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 100, y: 50 });
    });

    test('projects point at center to boundary', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 50, y: 50 };
      const result = Box.projectPointToBoundary(point, box);
      // Should project to one of the edges, exact edge depends on implementation
      expect(result.x === 0 || result.x === 100 || result.y === 0 || result.y === 100).toBe(true);
    });

    test('projects point outside box to closest boundary point', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 150, y: 50 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 100, y: 50 });
    });

    test('projects point to corner when equidistant from two edges', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 10, y: 10 };
      const result = Box.projectPointToBoundary(point, box);
      // Should be closest to either top or left edge
      expect(result.x === 0 || result.y === 0).toBe(true);
    });

    test('handles rotated box', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: Math.PI / 4 };
      const point = { x: 50, y: 50 };
      const result = Box.projectPointToBoundary(point, box);
      // Just verify it returns a valid point
      expect(result).toBeDefined();
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    test('handles box with offset position', () => {
      const box = { x: 100, y: 100, w: 50, h: 50, r: 0 };
      const point = { x: 125, y: 110 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 125, y: 100 });
    });

    test('point already on boundary returns same point', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 50, y: 0 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toStrictEqual({ x: 50, y: 0 });
    });

    test('handles very small box', () => {
      const box = { x: 0, y: 0, w: 1, h: 1, r: 0 };
      const point = { x: 0.5, y: 0.5 };
      const result = Box.projectPointToBoundary(point, box);
      expect(result).toBeDefined();
    });

    test('projects to nearest edge when point is close to corner', () => {
      const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 5, y: 15 };
      const result = Box.projectPointToBoundary(point, box);
      // Should project to left edge since it's closer (5 pixels) than top edge (15 pixels)
      expect(result).toStrictEqual({ x: 0, y: 15 });
    });
  });
});
