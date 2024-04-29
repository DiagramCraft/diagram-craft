import { Point } from './point';
import { Polygon } from './polygon';
import { Direction } from './direction';
import { Line } from './line';
import { Extent } from './extent';
import { DeepWriteable } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';

export type Box = Point & Extent & Readonly<{ r: number; _discriminator?: 'ro' }>;

export type WritableBox = DeepWriteable<Omit<Box, '_discriminator'>> & { _discriminator: 'rw' };

export const WritableBox = {
  asBox: (b: WritableBox): Box => {
    return { ...b, _discriminator: undefined };
  }
};

export const Box = {
  unit: () => ({ x: -1, y: -1, w: 2, h: 2, r: 0 }),

  asReadWrite: (b: Box): WritableBox => {
    return { ...b, _discriminator: 'rw' };
  },

  fromCorners: (a: Point, b: Point): Box => {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
      r: 0
    };
  },

  center: (b: Box) => {
    return {
      x: b.x + b.w / 2,
      y: b.y + b.h / 2
    };
  },

  isEqual: (a: Box, b: Box) => {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.r === b.r;
  },

  boundingBox: (boxes: Box[], forceAxisAligned = false): Box => {
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

  line: (box: Box, dir: Direction) => {
    const corners = Box.corners(box);
    if (dir === 'n') return Line.of(corners[0], corners[1]);
    if (dir === 's') return Line.of(corners[2], corners[3]);
    if (dir === 'w') return Line.of(corners[3], corners[0]);
    return Line.of(corners[1], corners[2]);
  },

  asPolygon: (box: Box): Polygon => {
    return { points: Box.corners(box) };
  },

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

  normalize: (b: Box) => {
    return {
      x: Math.min(b.x, b.x + b.w),
      y: Math.min(b.y, b.y + b.h),
      r: b.r,
      w: Math.abs(b.w),
      h: Math.abs(b.h)
    };
  },

  fromLine: (l: Line): Box => {
    return {
      ...l.from,
      w: l.to.x - l.from.x,
      h: l.to.y - l.from.y,
      r: 0
    };
  }

  /*
  withRotation: (b: Box, r: number) => ({ ...b, size: { ...b.size }, rotation: r })


  fromDomRect: (rect: DOMRect): Box => {
    return {
      pos: { x: rect.x, y: rect.y },
      size: { w: rect.width, h: rect.height },
      rotation: 0
    };
  },

  fromElement: (el: Element): Box => {
    const rect = el.getBoundingClientRect();
    return {
      pos: { x: rect.x, y: rect.y },
      size: { w: rect.width, h: rect.height },
      rotation: 0
    };
  },

  asDomRect: (b: Box): DOMRect => {
    return new DOMRect(b.pos.x, b.pos.y, b.size.w, b.size.h);
  },*/
};
