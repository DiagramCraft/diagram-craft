import { Point } from './point.ts';
import { Polygon } from './polygon.ts';
import { Direction } from './direction.ts';
import { Line } from './line.ts';
import { MutableSnapshot } from '../utils/mutableSnapshot.ts';
import { Extent } from './extent.ts';
import { round } from '../utils/math.ts';

export type Box = Readonly<{
  pos: Point;
  size: Extent;
  rotation: number;
}>;

class BoxMutableSnapshot extends MutableSnapshot<Box> {
  getSnapshot(): Box {
    return {
      size: { ...this.value.size },
      pos: { ...this.value.pos },
      rotation: this.value.rotation
    };
  }
}

export const Box = {
  asMutableSnapshot: (b: Box): MutableSnapshot<Box> => {
    return new BoxMutableSnapshot({
      pos: { ...b.pos },
      size: { ...b.size },
      rotation: b.rotation
    });
  },
  fromCorners: (a: Point, b: Point): Box => {
    return {
      pos: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      size: { w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) },
      rotation: 0
    };
  },
  center: (b: Box) => {
    return {
      x: b.pos.x + b.size.w / 2,
      y: b.pos.y + b.size.h / 2
    };
  },

  isEqual: (a: Box, b: Box) => {
    return (
      a.pos.x === b.pos.x &&
      a.pos.y === b.pos.y &&
      a.size.w === b.size.w &&
      a.size.h === b.size.h &&
      a.rotation === b.rotation
    );
  },

  boundingBox: (boxes: Box[], forceAxisAligned = false): Box => {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    // If all boxes have the same rotation
    if (!forceAxisAligned && boxes.every(b => b.rotation === boxes[0].rotation)) {
      // Pick one corner of one box and rotate each corner of each box around it
      const rotationPoint = Box.corners(boxes[0], true)[0];
      for (const box of boxes) {
        for (const c of Box.corners(box, true)) {
          const rotated = Point.rotate(Point.subtract(c, rotationPoint), -box.rotation);

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
        }
      }

      const w = maxX - minX;
      const h = maxY - minY;

      const centerOfSelection = Point.rotate(
        { x: minX + w / 2, y: minY + h / 2 },
        boxes[0].rotation
      );

      const posOfSelection = Point.add(
        rotationPoint,
        Point.subtract(centerOfSelection, { x: w / 2, y: h / 2 })
      );

      return {
        pos: posOfSelection,
        size: { w: w, h: h },
        rotation: boxes[0].rotation
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
        pos: { x: minX, y: minY },
        size: { w: maxX - minX, h: maxY - minY },
        rotation: 0
      };
    }
  },

  corners: (box: Box, oppositeOnly = false) => {
    const corners = oppositeOnly
      ? [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h }
        ]
      : [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h },
          { x: box.pos.x, y: box.pos.y + box.size.h }
        ];

    if (round(box.rotation) === 0) return corners;

    return corners.map(c => Point.rotateAround(c, box.rotation, Box.center(box)));
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

    if ('pos' in c) {
      return Box.corners(c).every(c2 => Box.contains(box, c2));
    } else {
      if (box.rotation === 0) {
        return (
          c.x >= box.pos.x &&
          c.x <= box.pos.x + box.size.w &&
          c.y >= box.pos.y &&
          c.y <= box.pos.y + box.size.h
        );
      } else {
        return Polygon.contains(Box.asPolygon(box), c);
      }
    }
  },

  intersects: (box: Box, otherBox: Box) => {
    if (box.rotation === 0 && otherBox.rotation === 0) {
      return (
        box.pos.x <= otherBox.pos.x + otherBox.size.w &&
        box.pos.y <= otherBox.pos.y + otherBox.size.h &&
        box.pos.x + box.size.w >= otherBox.pos.x &&
        box.pos.y + box.size.h >= otherBox.pos.y
      );
    }
    return Polygon.intersects(Box.asPolygon(box), Box.asPolygon(otherBox));
  },

  normalize: (b: Box) => {
    return {
      pos: { x: Math.min(b.pos.x, b.pos.x + b.size.w), y: Math.min(b.pos.y, b.pos.y + b.size.h) },
      rotation: b.rotation,
      size: { w: Math.abs(b.size.w), h: Math.abs(b.size.h) }
    };
  },

  withX: (b: Box, x: number) => ({
    ...b,
    size: { ...b.size },
    pos: { ...b.pos, x },
    rotation: b.rotation
  }),
  withY: (b: Box, y: number) => ({
    ...b,
    size: { ...b.size },
    pos: { ...b.pos, y },
    rotation: b.rotation
  })
  /*
  withW: (b: Box, w: number) => ({ ...b, size: { ...b.size, w }, rotation: b.rotation }),

  withH: (b: Box, h: number) => ({ ...b, size: { ...b.size, h }, rotation: b.rotation }),

  withRotation: (b: Box, r: number) => ({ ...b, size: { ...b.size }, rotation: r })

  fromLine: (l: Line): Box => {
    return {
      pos: l.from,
      size: { w: l.to.x - l.from.x, h: l.to.y - l.from.y },
      rotation: 0
    };
  },

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
