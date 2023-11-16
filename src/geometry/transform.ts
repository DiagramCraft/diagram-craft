import { Vector } from './vector.ts';
import { Point } from './point.ts';
import { Box } from './box.ts';
import { round } from '../utils/math.ts';

export interface Transform {
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

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      return {
        pos: Point.add(b.pos, this.c),
        size: { ...b.size },
        rotation: b.rotation
      };
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

  private moveCenterPoint(b: Box, center: Point): Box {
    return {
      pos: {
        x: center.x - b.size.w / 2,
        y: center.y - b.size.h / 2
      },
      size: { ...b.size },
      rotation: b.rotation
    };
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('pos' in b) {
      const ret = this.moveCenterPoint(b, Point.rotate(Box.center(b), this.r));
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
