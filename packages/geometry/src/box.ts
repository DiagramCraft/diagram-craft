import { Point } from './point';
import { Polygon } from './polygon';
import { Direction } from './direction';
import { Line } from './line';
import { Extent } from './extent';
import { DeepWriteable } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';

/**
 * Represents a rectangle with position, dimensions, and rotation
 * A Box is a combination of a Point (x, y), an Extent (w, h), and a rotation (r)
 */
export type Box = Point & Extent & Readonly<{ r: number; _discriminator?: 'ro' }>;

/**
 * A writable version of Box that can be modified
 */
export type WritableBox = DeepWriteable<Omit<Box, '_discriminator'>> & { _discriminator: 'rw' };

/**
 * Utility functions for working with WritableBox objects
 */
export const WritableBox = {
  /**
   * Converts a WritableBox to a Box
   * @param b The WritableBox to convert
   * @returns A Box with the same properties
   */
  asBox: (b: WritableBox): Box => {
    return { ...b, _discriminator: undefined };
  }
};

export const Box = {
  /**
   * Returns a copy of the box with rotation set to 0
   */
  withoutRotation: (b: Box): Box => ({ ...b, r: 0 }),

  /**
   * Returns a unit box centered at origin with width and height of 2
   */
  unit: () => ({ x: -1, y: -1, w: 2, h: 2, r: 0 }),

  /**
   * Converts a Box to a WritableBox
   */
  asReadWrite: (b: Box): WritableBox => {
    return { ...b, _discriminator: 'rw' };
  },

  /**
   * Adjusts the box dimensions to match the given aspect ratio (width/height)
   * @param b The box to adjust
   * @param aspectRatio The target aspect ratio (width/height)
   * @returns A new box with the adjusted dimensions
   */
  applyAspectRatio: (b: Box, aspectRatio: number): Box => {
    if (aspectRatio === 1) return b;
    if (aspectRatio < 1) {
      const newW = b.h * aspectRatio;
      return { ...b, w: newW };
    } else {
      const newH = b.w / aspectRatio;
      return { ...b, h: newH };
    }
  },

  /**
   * Creates a box at origin (0,0) with the specified width and height
   * @param param0 Object containing width and height
   * @returns A new box
   */
  from: ({ w, h }: { w: number; h: number }): Box => {
    return { w, h, x: 0, y: 0, r: 0 };
  },

  /**
   * Creates a box from two corner points
   * @param a First corner point
   * @param b Second corner point
   * @returns A new box that encompasses both points
   */
  fromCorners: (a: Point, b: Point): Box => {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
      r: 0
    };
  },

  /**
   * Calculates the center point of a box
   * @param b The box
   * @returns The center point
   */
  center: (b: Box) => {
    return {
      x: b.x + b.w / 2,
      y: b.y + b.h / 2
    };
  },

  /**
   * Checks if two boxes are exactly equal
   * @param a First box
   * @param b Second box
   * @returns True if boxes are equal, false otherwise
   */
  isEqual: (a: Box, b: Box) => {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.r === b.r;
  },

  /**
   * Calculates the bounding box that contains all the given boxes
   * @param boxes Array of boxes to calculate the bounding box for
   * @param forceAxisAligned If true, the resulting box will have rotation 0,
   *                         otherwise it will try to preserve rotation if all boxes have the same rotation
   * @returns A new box that contains all the input boxes
   */
  boundingBox: (boxes: Box[], forceAxisAligned = false): Box => {
    if (boxes.length === 0) {
      return { x: 0, y: 0, w: 0, h: 0, r: 0 };
    }

    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    // If all boxes have the same rotation
    if (!forceAxisAligned && boxes.every(b => b.r === boxes[0].r)) {
      // Pick one corner of one box and rotate each corner of each box around it
      const rotationPoint = Box.corners(boxes[0], true)[0];
      for (const box of boxes) {
        for (const c of Box.corners(box, true)) {
          const rotated = Point.rotate(Point.subtract(c, rotationPoint), -box.r);

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
        }
      }

      const w = maxX - minX;
      const h = maxY - minY;

      const centerOfSelection = Point.rotate({ x: minX + w / 2, y: minY + h / 2 }, boxes[0].r);

      const posOfSelection = Point.add(
        rotationPoint,
        Point.subtract(centerOfSelection, { x: w / 2, y: h / 2 })
      );

      return {
        ...posOfSelection,
        w: w,
        h: h,
        r: boxes[0].r
      };
    } else {
      for (const box of boxes) {
        const corners = Box.corners(box);
        for (const c of corners) {
          minX = Math.min(minX, c.x);
          minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x);
          maxY = Math.max(maxY, c.y);
        }
      }

      return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
        r: 0
      };
    }
  },

  /**
   * Calculates the corners of a box
   * @param box The box
   * @param oppositeOnly If true, returns only the top-left and bottom-right corners,
   *                     otherwise returns all four corners
   * @returns Array of corner points, clockwise from top-left
   */
  corners: (box: Box, oppositeOnly = false) => {
    const corners = oppositeOnly
      ? [
          { x: box.x, y: box.y },
          { x: box.x + box.w, y: box.y + box.h }
        ]
      : [
          { x: box.x, y: box.y },
          { x: box.x + box.w, y: box.y },
          { x: box.x + box.w, y: box.y + box.h },
          { x: box.x, y: box.y + box.h }
        ];

    if (round(box.r) === 0) return corners;

    return corners.map(c => Point.rotateAround(c, box.r, Box.center(box)));
  },

  /**
   * Gets a line representing one of the edges of the box
   * @param box The box
   * @param dir The direction indicating which edge to get (n=top, e=right, s=bottom, w=left)
   * @returns A line representing the specified edge
   */
  line: (box: Box, dir: Direction) => {
    const corners = Box.corners(box);
    if (dir === 'n') return Line.of(corners[0], corners[1]);
    if (dir === 's') return Line.of(corners[2], corners[3]);
    if (dir === 'w') return Line.of(corners[3], corners[0]);
    return Line.of(corners[1], corners[2]);
  },

  /**
   * Converts a box to a polygon
   * @param box The box to convert
   * @returns A polygon with vertices at the corners of the box
   */
  asPolygon: (box: Box): Polygon => {
    return { points: Box.corners(box) };
  },

  /**
   * Checks if a box contains a point or another box
   * @param box The container box (can be undefined)
   * @param c The point or box to check
   * @returns True if the box contains the point or box, false otherwise
   */
  contains: (box: Box | undefined, c: Box | Point): boolean => {
    if (!box) return false;

    if ('w' in c) {
      return Box.corners(c).every(c2 => Box.contains(box, c2));
    } else {
      if (box.r === 0) {
        return c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y && c.y <= box.y + box.h;
      } else {
        return Polygon.contains(Box.asPolygon(box), c);
      }
    }
  },

  grow: (box: Box, amount: number): Box => {
    return {
      x: box.x - amount,
      y: box.y - amount,
      w: box.w + amount * 2,
      h: box.h + amount * 2,
      r: box.r
    };
  },

  /**
   * Checks if two boxes intersect
   * @param box First box
   * @param otherBox Second box
   * @returns True if the boxes intersect, false otherwise
   */
  intersects: (box: Box, otherBox: Box) => {
    if (box.r === 0 && otherBox.r === 0) {
      return (
        box.x <= otherBox.x + otherBox.w &&
        box.y <= otherBox.y + otherBox.h &&
        box.x + box.w >= otherBox.x &&
        box.y + box.h >= otherBox.y
      );
    }
    return Polygon.intersects(Box.asPolygon(box), Box.asPolygon(otherBox));
  },

  /**
   * Normalizes a box to ensure width and height are positive
   * @param b The box to normalize
   * @returns A new box with positive width and height
   */
  normalize: (b: Box) => {
    return {
      x: Math.min(b.x, b.x + b.w),
      y: Math.min(b.y, b.y + b.h),
      r: b.r,
      w: Math.abs(b.w),
      h: Math.abs(b.h)
    };
  },

  /**
   * Creates a box from a line
   * @param l The line
   * @returns A box with the line's from point as the top-left corner and dimensions based on the line
   */
  fromLine: (l: Line): Box => {
    return {
      ...l.from,
      w: l.to.x - l.from.x,
      h: l.to.y - l.from.y,
      r: 0
    };
  },

  /**
   * Calculates a point within a box based on relative offset
   * @param b The box
   * @param offset The relative offset (0-1 for each dimension)
   * @returns A point within the box
   */
  fromOffset: (b: Box, offset: Point) => {
    return { x: b.x + offset.x * b.w, y: b.y + offset.y * b.h };
  },

  /**
   * Calculates the midpoint between two boxes based on their closest edges
   * @param box1 First box
   * @param box2 Second box
   * @returns Point representing the midpoint between the closest edges of the boxes
   */
  midpoint: (box1: Box, box2: Box): Point => {
    const corners1 = Box.corners(box1);
    const corners2 = Box.corners(box2);

    const min1X = Math.min(...corners1.map(c => c.x));
    const max1X = Math.max(...corners1.map(c => c.x));
    const min1Y = Math.min(...corners1.map(c => c.y));
    const max1Y = Math.max(...corners1.map(c => c.y));

    const min2X = Math.min(...corners2.map(c => c.x));
    const max2X = Math.max(...corners2.map(c => c.x));
    const min2Y = Math.min(...corners2.map(c => c.y));
    const max2Y = Math.max(...corners2.map(c => c.y));

    const x =
      max1X < min2X
        ? (max1X + min2X) / 2
        : min1X > max2X
          ? (min1X + max2X) / 2
          : (max1X + max1X) / 2;

    const y =
      max1Y < min2Y
        ? (max1Y + min2Y) / 2
        : min1Y > max2Y
          ? (min1Y + max2Y) / 2
          : (max1Y + max1Y) / 2;

    return { x, y };
  }
};
