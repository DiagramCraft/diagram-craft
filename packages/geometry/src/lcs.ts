import { Box } from './box.ts';
import { Rotation, Transform, Translation } from './transform.ts';
import { Point } from './point.ts';

// Note, this provides an "unscaled" local coordinate system.
export class LocalCoordinateSystem {
  static UNITY = new LocalCoordinateSystem({ x: 0, y: 0, w: 1, h: 1, r: 0 });

  static fromBox(box: Box) {
    if (Point.isEqual(Point.ORIGIN, box) && box.r === 0 && box.w === 1 && box.h === 1)
      return this.UNITY;
    return new LocalCoordinateSystem(box);
  }

  constructor(private readonly box: Box) {}

  toGlobal(c: Box): Box;
  toGlobal(c: Point): Point;
  toGlobal(c: Box | Point): Box | Point {
    if ('w' in c) {
      return Transform.box(c as Box, new Rotation(this.box.r), new Translation(this.box));
    } else {
      return Transform.point(c as Point, new Rotation(this.box.r), new Translation(this.box));
    }
  }

  toLocal(c: Box): Box;
  toLocal(c: Point): Point;
  toLocal(c: Box | Point): Box | Point {
    if ('w' in c) {
      return Transform.box(
        c as Box,
        new Translation({ x: -this.box.x, y: -this.box.y }),
        new Rotation(-this.box.r)
      );
    } else {
      return Transform.point(
        c as Point,
        new Translation({ x: -this.box.x, y: -this.box.y }),
        new Rotation(-this.box.r)
      );
    }
  }
}
