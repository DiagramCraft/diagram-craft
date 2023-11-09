import { invariant, NOT_IMPLEMENTED_YET, precondition } from '../utils/assert.ts';

type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

abstract class MutableSnapshot<T> {
  protected value: DeepWriteable<T>;

  constructor(value: T) {
    this.value = value;
  }

  get<K extends keyof T>(k: K) {
    return this.value[k];
  }

  set<K extends keyof T>(k: K, v: T[K]) {
    this.value[k] = v;
  }

  abstract getSnapshot(): T;
}

const round = (n: number) => {
  const res = Math.round(n * 100) / 100;
  // To ensure -0 === 0
  if (res === 0) return 0;
  return res;
};

export type Point = Readonly<{
  x: number;
  y: number;
}>;

export type Extent = Readonly<{
  w: number;
  h: number;
}>;

export type Box = Readonly<{
  pos: Point;
  size: Extent;
  rotation: number;
}>;

export type Line = Readonly<{
  from: Point;
  to: Point;
}>;

export const Line = {
  extend: (line: Line, fromLength: number, toLength: number) => {
    const v = Vector.from(line.from, line.to);
    const unit = Vector.scale(v, 1 / Math.sqrt(v.x * v.x + v.y * v.y));
    return {
      from: Point.subtract(line.from, Vector.scale(unit, fromLength)),
      to: Point.add(line.to, Vector.scale(unit, toLength))
    };
  },

  from: (from: Point, to: Point) => {
    return { from, to };
  },

  midpoint: (line: Line) => {
    return Point.midpoint(line.from, line.to);
  },

  isHorizontal: (line: Line) => {
    return round(line.from.y) === round(line.to.y);
  },

  isVertical: (line: Line) => {
    return round(line.from.x) === round(line.to.x);
  }
};

class BoxMutableSnapshot extends MutableSnapshot<Box> {
  getSnapshot(): Box {
    return {
      size: { ...this.value.size },
      pos: { ...this.value.pos },
      rotation: this.value.rotation
    };
  }
}

export type Polygon = {
  points: Point[];
};

export type Vector = Point;

export const Angle = {
  toDeg: (radians: number) => {
    return radians * (180 / Math.PI);
  },

  toRad: (degrees: number) => {
    return degrees * (Math.PI / 180);
  }
};

export const Point = {
  ORIGIN: { x: 0, y: 0 },

  add: (c1: Point, c2: Vector) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),
  subtract: (c1: Point, c2: Vector) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  midpoint: (c1: Point, c2: Point) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  fromEvent: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  round: (c: Point) => {
    return { x: round(c.x), y: round(c.y) };
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
    return Point.add(rotatedCoord, centerOfRotation);
  },

  isEqual: (a: Point, b: Point) => {
    return a.x === b.x && a.y === b.y;
  },
  distance(posA: Point, posB: Point) {
    return Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
  }
};

export const Box = {
  asMutableSnapshot: (b: Box): MutableSnapshot<Box> => {
    return new BoxMutableSnapshot({
      pos: { ...b.pos },
      size: { ...b.size },
      rotation: b.rotation
    });
  },

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
    return {
      pos: {
        x: center.x - b.size.w / 2,
        y: center.y - b.size.h / 2
      },
      size: { ...b.size },
      rotation: b.rotation
    };
  },

  // TODO: This should not be part of the Box API
  boundingBox: (boxes: Box[]): Box => {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    // If all boxes have the same rotation
    if (boxes.every(b => b.rotation === boxes[0].rotation)) {
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
          const rotated = Point.rotateAround(c, box.rotation, Box.center(box));

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
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
    return Polygon.intersects(Box.asPolygon(box), Box.asPolygon(otherBox));
  },

  translate: (b: Box, c: Point): Box => {
    return {
      pos: Point.add(b.pos, c),
      size: { ...b.size },
      rotation: b.rotation
    };
  },

  // TODO: Do we want this, or should we use negative width and negative heigh
  //       as an indicator for flipping a node
  normalize: (b: Box) => {
    return {
      pos: { x: Math.min(b.pos.x, b.pos.x + b.size.w), y: Math.min(b.pos.y, b.pos.y + b.size.h) },
      rotation: b.rotation,
      size: { w: Math.abs(b.size.w), h: Math.abs(b.size.h) }
    };
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

        let minA: number | undefined;
        let maxA: number | undefined;
        for (const p of a.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (minA === undefined || projected < minA) minA = projected;
          if (maxA === undefined || projected > maxA) maxA = projected;
        }

        invariant.is.present(minA);
        invariant.is.present(maxA);

        let minB: number | undefined;
        let maxB: number | undefined;
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
    return Math.atan2(v.y, v.x) + Math.PI / 2;
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
  invert(): Transform;
}

export const Transform = {
  box: (b: Box, ...transforms: Transform[]): Box => {
    return transforms.reduce((b, t) => t.apply(b), b);
  },
  point: (b: Point, ...transforms: Transform[]): Point => {
    return transforms.reduce((b, t) => t.apply(b), b);
  }
};

export class Noop implements Transform {
  asSvgTransform() {
    return '';
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    return b;
  }

  invert(): Transform {
    return new Noop();
  }
}

export class Translation implements Transform {
  static toOrigin(b: Box | Point, pointOfReference: 'center' | 'top-left' = 'top-left') {
    if ('pos' in b) {
      if (pointOfReference === 'center') {
        return new Translation(Vector.negate(Box.center(b)));
      } else {
        return new Translation(Vector.negate(b.pos));
      }
    } else {
      return new Translation(Vector.negate(b));
    }
  }

  constructor(private readonly c: Point) {}

  asSvgTransform() {
    return `translate(${this.c.x},${this.c.y})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return Box.translate(b, this.c);
    } else {
      return Point.add(b, this.c);
    }
  }

  invert(): Transform {
    return new Translation(Vector.negate(this.c));
  }
}

export class Scale implements Transform {
  constructor(
    private readonly x: number,
    private readonly y: number
  ) {}

  asSvgTransform() {
    return `scale(${this.x},${this.y})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return {
        pos: { x: b.pos.x * this.x, y: b.pos.y * this.y },
        size: { w: b.size.w * this.x, h: b.size.h * this.y },
        rotation: b.rotation
      };
    } else {
      return { x: b.x * this.x, y: b.y * this.y };
    }
  }

  invert(): Transform {
    return new Scale(1 / this.x, 1 / this.y);
  }
}

export class Rotation implements Transform {
  static reset(b: Box) {
    if (round(b.rotation) === 0) return new Noop();
    return new Rotation(-b.rotation);
  }

  constructor(private readonly r: number) {}

  asSvgTransform() {
    return `rotate(${this.r})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      const ret = Box.moveCenterPoint(b, Point.rotate(Box.center(b), this.r));
      return {
        pos: ret.pos,
        size: ret.size,
        rotation: ret.rotation + this.r
      };
    } else {
      return Point.rotate(b, this.r);
    }
  }

  invert(): Transform {
    return new Rotation(-this.r);
  }
}

// TODO: For this to work, we need to keep a shear x and shear y on the node
export class Shear implements Transform {
  constructor(
    private readonly amount: number,
    private readonly axis: 'x' | 'y'
  ) {}

  asSvgTransform() {
    return `skew${this.axis.toUpperCase()}(${this.amount})`;
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return {
        pos: b.pos,
        size: {
          w: this.axis === 'x' ? b.size.w + b.size.h * this.amount : b.size.w,
          h: this.axis === 'y' ? b.size.h + b.size.w * this.amount : b.size.h
        },
        rotation: b.rotation
      };
      return b;
    } else {
      return {
        x: this.axis === 'x' ? b.x + b.y * this.amount : b.x,
        y: this.axis === 'y' ? b.y + b.x * this.amount : b.y
      };
    }
  }

  invert(): Transform {
    return new Shear(-this.amount, this.axis);
  }
}

// TODO: We probably want to add flipX and flipY

export const TransformFactory = {
  fromTo: (before: Box, after: Box): Transform[] => {
    const scaleX = after.size.w / before.size.w;
    const scaleY = after.size.h / before.size.h;

    const rot = after.rotation - before.rotation;

    const toOrigin = Translation.toOrigin(before, 'center');
    const translateBack = Translation.toOrigin(after, 'center').invert();

    const transforms: Transform[] = [];
    transforms.push(toOrigin);

    if (scaleX !== 1 || scaleY !== 1) {
      // If both scale and rotation, we need to reset the rotation first
      if (after.rotation !== 0 || before.rotation !== 0) {
        transforms.push(Rotation.reset(before));
        transforms.push(new Scale(scaleX, scaleY));
        transforms.push(new Rotation(after.rotation));
      } else {
        transforms.push(new Scale(scaleX, scaleY));
      }
    } else {
      if (rot !== 0) transforms.push(new Rotation(rot));
    }

    transforms.push(translateBack);

    return transforms;
  }
};

export class LocalCoordinateSystem {
  static UNITY = new LocalCoordinateSystem({ x: 0, y: 0 }, 0);

  static fromBox(box: Box) {
    if (Point.isEqual(Point.ORIGIN, box.pos) && box.rotation === 0) return this.UNITY;
    return new LocalCoordinateSystem(Box.center(box), box.rotation);
  }

  constructor(
    private readonly origin: Point,
    private readonly rotation: number
  ) {}

  toGlobal(c: Box): Box;
  toGlobal(c: Point): Point;
  toGlobal(c: Box | Point): Box | Point {
    // TODO: Need to use translation when needed
    if (this.origin !== this.origin) NOT_IMPLEMENTED_YET();
    if ('pos' in c) return new Rotation(this.rotation).apply(c);
    return new Rotation(this.rotation).apply(c);
  }

  toLocal(c: Box): Box;
  toLocal(c: Point): Point;
  toLocal(c: Box | Point): Box | Point {
    // TODO: Need to use translation when needed
    if (this.origin !== this.origin) NOT_IMPLEMENTED_YET();
    if ('pos' in c) return new Rotation(-this.rotation).apply(c);
    return new Rotation(-this.rotation).apply(c);
  }
}
