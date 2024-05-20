import { Box } from './box';
import { Rotation, Scale, Transform, Translation } from './transform';
import { Point } from './point';
import { VerifyNotReached } from '@diagram-craft/utils/assert';

const isBox = (c: Box | Point): c is Box => 'w' in c;
const isPoint = (c: Box | Point): c is Point => 'x' in c;

// Note, this provides an "unscaled" local coordinate system.
export class LocalCoordinateSystem {
  static UNITY = new LocalCoordinateSystem({ x: 0, y: 0, w: 1, h: 1, r: 0 });
  private toGlobalTransforms: Transform[];
  private toLocalTransforms: Transform[];

  static fromBox(box: Box) {
    if (Point.isEqual(Point.ORIGIN, box) && box.r === 0 && box.w === 1 && box.h === 1)
      return this.UNITY;
    return new LocalCoordinateSystem(box);
  }

  constructor(box: Box, xRange?: [number, number], yRange?: [number, number], flipY?: boolean) {
    this.toGlobalTransforms = [];
    if (xRange && xRange[0] !== 0) {
      this.toGlobalTransforms.push(new Translation({ x: -xRange[0], y: 0 }));
    }
    if (yRange && yRange[0] !== 0) {
      this.toGlobalTransforms.push(new Translation({ x: 0, y: -yRange[0] }));
    }

    if (flipY) {
      const yr = yRange ? yRange[1] - yRange[0] : 1;
      this.toGlobalTransforms.push(new Scale(1, -1));
      this.toGlobalTransforms.push(new Translation({ x: 0, y: yr }));
    }

    this.toGlobalTransforms.push(
      new Scale(
        xRange ? (xRange[1] - xRange[0]) * box.w : 1,
        yRange ? (yRange[1] - yRange[0]) * box.h : 1
      )
    );

    this.toGlobalTransforms.push(new Rotation(box.r), new Translation(box));

    const temp = [...this.toGlobalTransforms];
    temp.reverse();
    this.toLocalTransforms = temp.map(e => e.invert());
  }

  toGlobal(c: Box): Box;
  toGlobal(c: Point): Point;
  toGlobal(c: Box | Point): Box | Point {
    if (isBox(c)) {
      return Transform.box(c, ...this.toGlobalTransforms);
    } else if (isPoint(c)) {
      return Transform.point(c, ...this.toGlobalTransforms);
    } else {
      throw new VerifyNotReached();
    }
  }

  toLocal(c: Box): Box;
  toLocal(c: Point): Point;
  toLocal(c: Box | Point): Box | Point {
    if (isBox(c)) {
      return Transform.box(c, ...this.toLocalTransforms);
    } else if (isPoint(c)) {
      return Transform.point(c, ...this.toLocalTransforms);
    } else {
      throw new VerifyNotReached();
    }
  }
}
