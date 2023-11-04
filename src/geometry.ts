import { invariant, precondition } from './assert.ts';

const round = (n: number) => {
  return Math.round(n * 100) / 100;
};

export type Point = {
  x: number;
  y: number;
};

export type Extent = {
  w: number;
  h: number;
};

export type Box = {
  pos: Point;
  size: Extent;
  rotation?: number;
};

export type Polygon = {
  points: Point[];
};

export type Vector = Point;

export type Angle = {
  type: 'deg' | 'rad';
  amount: number;
};

export const Angle = {
  toDeg: (radians: Angle | number) => {
    if (typeof radians === 'number') return radians * (180 / Math.PI);
    if (radians.type === 'deg') return radians.amount;
    return radians.amount * (180 / Math.PI);
  },

  toRad: (degrees: Angle | number) => {
    if (typeof degrees === 'number') return degrees * (Math.PI / 180);
    if (degrees.type === 'rad') return degrees.amount;
    return degrees.amount * (Math.PI / 180);
  }
};

export const Point = {
  add: (c1: Point, c2: Point) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),
  subtract: (c1: Point, c2: Point) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  midpoint: (c1: Point, c2: Point) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  fromEvent: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  round: (c: Point) => {
    return { x: round(c.x), y: round(c.y) };
  },

  translate: (c: Point, d: Vector): Point => {
    return { x: c.x + d.x, y: c.y + d.y };
  },

  rotate: (c: Point, r: number) => {
    return {
      x: c.x * Math.cos(r) - c.y * Math.sin(r),
      y: c.x * Math.sin(r) + c.y * Math.cos(r)
    };
  },

  rotateAround: (c: Point, r: number, centerOfRotation: Point) => {
    const newCoord = Point.subtract(c, centerOfRotation);
    const rotatedCoord = Point.rotate(newCoord, r);
    return Point.translate(rotatedCoord, centerOfRotation);
  },

  isEqual: (a: Point, b: Point) => {
    return a.x === b.x && a.y === b.y;
  }
};

export const Box = {
  center: (b: Box) => {
    return {
      x: b.pos.x + b.size.w / 2,
      y: b.pos.y + b.size.h / 2
    };
  },

  equals: (a: Box, b: Box) => {
    return (
      a.pos.x === b.pos.x &&
      a.pos.y === b.pos.y &&
      a.size.w === b.size.w &&
      a.size.h === b.size.h &&
      a.rotation === b.rotation
    );
  },

  moveCenterPoint: (b: Box, center: Point): Box => {
    b.pos = {
      x: center.x - b.size.w / 2,
      y: center.y - b.size.h / 2
    };
    return b;
  },

  boundingBox: (boxes: Box[]): Box => {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    // If all boxes have the same rotation
    if (boxes.every(b => b.rotation === boxes[0].rotation) && boxes[0].rotation !== undefined) {
      // Pick one corner of one box and rotate each corner of each box around it
      const rotationPoint = Box.corners(boxes[0], true)[0];
      for (const box of boxes) {
        for (const c of Box.corners(box, true)) {
          const rotated = Point.rotate(
            Point.subtract(c, rotationPoint),
            -Angle.toRad(box.rotation ?? 0)
          );

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
        Angle.toRad(boxes[0].rotation ?? 0)
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
        minX = Math.min(minX, box.pos.x, box.pos.x + box.size.w);
        minY = Math.min(minY, box.pos.y, box.pos.y + box.size.h);
        maxX = Math.max(maxX, box.pos.x, box.pos.x + box.size.w);
        maxY = Math.max(maxY, box.pos.y, box.pos.y + box.size.h);

        const corners = [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y },
          { x: box.pos.x, y: box.pos.y + box.size.h },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h }
        ];
        for (const c of corners) {
          const rotated = Point.rotateAround(c, Angle.toRad(box.rotation ?? 0), Box.center(box));

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
        }
      }

      return {
        pos: { x: minX, y: minY },
        size: { w: maxX - minX, h: maxY - minY }
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

    if (box.rotation === undefined || round(box.rotation) === 0) return corners;

    return corners.map(c => Point.rotateAround(c, Angle.toRad(box.rotation ?? 0), Box.center(box)));
  },

  asPolygon: (box: Box): Polygon => {
    return { points: Box.corners(box) };
  },

  contains: (box: Box | undefined, c: Box | Point): boolean => {
    if (!box) return false;

    if ('pos' in c) {
      return Box.corners(c).every(c2 => Box.contains(box, c2));
    } else {
      if (box.rotation === undefined || box.rotation === 0) {
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
    return Polygon.intersects(Box.asPolygon(box), Box.asPolygon(otherBox));
  },

  snapshot(b: Box) {
    return { size: { ...b.size }, pos: { ...b.pos }, rotation: b.rotation };
  },

  translate: (b: Box, c: Point): Box => {
    return {
      pos: Point.add(b.pos, c),
      size: { ...b.size }
    };
  },

  normalize: (b: Box) => {
    if (b.size.w < 0) {
      b.pos.x += b.size.w;
      b.size.w *= -1;
    }

    if (b.size.h < 0) {
      b.pos.y += b.size.h;
      b.size.h *= -1;
    }

    return b;
  },

  scale: (b: Box, s: number): Box => {
    const midpoint = Box.center(b);
    const newMidpoint = Point.subtract(midpoint, b.pos);
    const scaledMidpoint = Point.subtract(newMidpoint, {
      x: newMidpoint.x * s,
      y: newMidpoint.y * s
    });
    const newBox = Box.translate(b, scaledMidpoint);
    newBox.size.w *= s;
    newBox.size.h *= s;
    return newBox;
  },

  rotate: (b: Box, r: number): Box => {
    const midpoint = Box.center(b);
    const newMidpoint = Point.subtract(midpoint, b.pos);
    const rotatedMidpoint = {
      x: newMidpoint.x * Math.cos(r) - newMidpoint.y * Math.sin(r),
      y: newMidpoint.x * Math.sin(r) + newMidpoint.y * Math.cos(r)
    };
    const newBox = Box.translate(b, rotatedMidpoint);
    newBox.rotation = r;
    return newBox;
  }
};

export const Polygon = {
  intersects(a: Polygon, b: Polygon) {
    for (const polygon of [a, b]) {
      for (let i = 0; i < polygon.points.length; i++) {
        const j = (i + 1) % polygon.points.length;

        const start = polygon.points[i];
        const end = polygon.points[j];

        const normal = { y: end.y - start.y, x: start.x - end.x };

        let minA: number | undefined = undefined;
        let maxA: number | undefined = undefined;
        for (const p of a.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (minA === undefined || projected < minA) minA = projected;
          if (maxA === undefined || projected > maxA) maxA = projected;
        }

        invariant.is.present(minA);
        invariant.is.present(maxA);

        let minB: number | undefined = undefined;
        let maxB: number | undefined = undefined;
        for (const p of b.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (minB === undefined || projected < minB) minB = projected;
          if (maxB === undefined || projected > maxB) maxB = projected;
        }

        invariant.is.present(minB);
        invariant.is.present(maxB);

        if (maxA < minB || maxB < minA) return false;
      }
    }
    return true;
  },

  contains: (polygon: Polygon, testPoint: Point) => {
    precondition.is.true(polygon.points.length >= 3);

    const crossProducts: number[] = [];

    for (let i = 0; i < polygon.points.length; i++) {
      if (Point.isEqual(polygon.points[i], testPoint)) return true;

      const start = polygon.points[i];
      const end = polygon.points[(i + 1) % polygon.points.length];

      crossProducts.push(
        Vector.crossProduct(Vector.from(start, end), Vector.from(testPoint, start))
      );
    }

    return crossProducts.every(d => d >= 0) || crossProducts.every(d => d <= 0);
  }
};

export const Vector = {
  from: (c1: Point, c2: Point) => {
    return { x: c2.x - c1.x, y: c2.y - c1.y };
  },
  crossProduct: (v1: Vector, v2: Vector) => {
    return v1.x * v2.y - v1.y * v2.x;
  },
  angle: (v: Vector) => {
    return Angle.toDeg(Math.atan2(v.y, v.x) + Math.PI / 2);
  },
  negate: (c: Vector) => ({ x: -c.x, y: -c.y }),

  scale: (c: Vector, s: number) => {
    return { x: c.x * s, y: c.y * s };
  }
};

export interface Transform {
  asSvgTransform(): string;
  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point;
  reverse(): Transform;
}

export const Transform = {
  box: (b: Box, ...transforms: Transform[]): Box => {
    return transforms.reduce((b, t) => t.apply(b), b);
  },
  coord: (b: Point, ...transforms: Transform[]): Point => {
    return transforms.reduce((b, t) => t.apply(b), b);
  }
};

export class Translation implements Transform {
  constructor(private readonly c: Point) {}

  asSvgTransform() {
    return `translate(${this.c.x},${this.c.y})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return Box.translate(b, this.c) as Box;
    } else {
      return Point.translate(b, this.c) as Point;
    }
  }

  reverse(): Transform {
    return new Translation(Vector.negate(this.c));
  }
}

export class Scale implements Transform {
  constructor(private readonly s: number) {}

  asSvgTransform() {
    return `scale(${this.s})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return Box.scale(b, this.s);
    } else {
      return Vector.scale(b, this.s);
    }
  }

  reverse(): Transform {
    return new Scale(1 / this.s);
  }
}

export class Rotation implements Transform {
  constructor(private readonly r: number) {}

  asSvgTransform() {
    return `rotate(${this.r})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return Box.rotate(b, this.r);
    } else {
      return Point.rotate(b, this.r);
    }
  }

  reverse(): Transform {
    return new Rotation(-this.r);
  }
}
