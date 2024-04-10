import { Vector } from './vector';
import { Point } from './point';
import { Box } from './box';
import { round } from '@diagram-craft/utils/math';

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
    if ('w' in b) {
      if (pointOfReference === 'center') {
        return new Translation(Vector.negate(Box.center(b)));
      } else {
        return new Translation(Vector.negate(b));
      }
    } else {
      return new Translation(Vector.negate(b));
    }
  }

  constructor(private readonly c: Point) {}

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('w' in b) {
      return {
        ...b,
        ...Point.add(b, this.c)
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
    if ('w' in b) {
      return {
        x: b.x * this.x,
        y: b.y * this.y,
        w: b.w * this.x,
        h: b.h * this.y,
        r: b.r
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
    if (round(b.r) === 0) return new Noop();
    return new Rotation(-b.r);
  }

  constructor(private readonly r: number) {}

  private moveCenterPoint(b: Box, center: Point): Box {
    return {
      ...b,
      x: center.x - b.w / 2,
      y: center.y - b.h / 2
    };
  }

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('w' in b) {
      const ret = this.moveCenterPoint(b, Point.rotate(Box.center(b), this.r));
      return {
        ...ret,
        r: ret.r + this.r
      };
    } else {
      return Point.rotate(b, this.r);
    }
  }

  invert(): Transform {
    return new Rotation(-this.r);
  }
}

export class Shear implements Transform {
  constructor(
    private readonly amount: number,
    private readonly axis: 'x' | 'y'
  ) {}

  apply(b: Box): Box;
  apply(b: Point): Point;
  apply(b: Box | Point): Box | Point {
    if ('w' in b) {
      return {
        ...b,
        w: this.axis === 'x' ? b.w + b.h * this.amount : b.w,
        h: this.axis === 'y' ? b.h + b.w * this.amount : b.h
      };
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

export const TransformFactory = {
  fromTo: (before: Box, after: Box): Transform[] => {
    const scaleX = after.w / before.w;
    const scaleY = after.h / before.h;

    const rot = after.r - before.r;

    const toOrigin = Translation.toOrigin(before, 'center');
    const translateBack = Translation.toOrigin(after, 'center').invert();

    const transforms: Transform[] = [];
    transforms.push(toOrigin);

    if (scaleX !== 1 || scaleY !== 1) {
      // If both scale and rotation, we need to reset the rotation first
      if (after.r !== 0 || before.r !== 0) {
        transforms.push(Rotation.reset(before));
        transforms.push(new Scale(scaleX, scaleY));
        transforms.push(new Rotation(after.r));
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
