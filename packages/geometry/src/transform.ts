/**
 * Transformation system for applying geometric transformations to points and boxes.
 *
 * This module provides a composable transformation system with support for translation,
 * rotation, and scaling. Transformations can be chained and inverted.
 *
 * @example
 * ```ts
 * import { Translation, Rotation, Scale, Transform } from '@diagram-craft/geometry/transform';
 *
 * // Apply a single transformation
 * const translation = new Translation({ x: 10, y: 20 });
 * const point = { x: 5, y: 5 };
 * const translated = translation.apply(point); // { x: 15, y: 25 }
 *
 * // Chain multiple transformations
 * const box = { x: 0, y: 0, w: 100, h: 100, r: 0 };
 * const transformed = Transform.box(
 *   box,
 *   new Translation({ x: 10, y: 20 }),
 *   new Rotation(Math.PI / 4),
 *   new Scale(2, 2)
 * );
 *
 * // Invert a transformation
 * const inverse = translation.invert();
 * const original = inverse.apply(translated); // Back to { x: 5, y: 5 }
 *
 * // Use factory methods
 * const transforms = TransformFactory.fromTo(
 *   { x: 0, y: 0, w: 100, h: 100, r: 0 },
 *   { x: 50, y: 50, w: 200, h: 200, r: Math.PI / 2 }
 * );
 * const result = Transform.box(box, ...transforms);
 *
 * // Rotate around a specific point
 * const rotateTransforms = TransformFactory.rotateAround(Math.PI / 4, { x: 50, y: 50 });
 * ```
 *
 * @module
 */

import { Vector } from './vector';
import { Point } from './point';
import { Box } from './box';
import { isSame, round } from '@diagram-craft/utils/math';
import { assert } from '@diagram-craft/utils/assert';

/**
 * Interface for geometric transformations that can be applied to points or boxes.
 *
 * All transformations support application to both Point and Box types, and can be inverted.
 */
export interface Transform {
  /** Applies the transformation to a box */
  apply(b: Box): Box;
  /** Applies the transformation to a point */
  apply(b: Point): Point;
  /** Applies the transformation to a box or point */
  apply(b: Box | Point): Box | Point;
  /** Returns the inverse transformation */
  invert(): Transform;
}

/**
 * Utility functions for applying transformations.
 *
 * @namespace
 */
export const Transform = {
  /**
   * Applies a sequence of transformations to a box.
   *
   * Transformations are applied left-to-right (first transformation is applied first).
   *
   * @param b The box to transform
   * @param transforms The transformations to apply in order
   * @returns The transformed box
   */
  box: (b: Box, ...transforms: Transform[]): Box => {
    return transforms.reduce((b, t) => t.apply(b), b);
  },

  /**
   * Applies a sequence of transformations to a point.
   *
   * Transformations are applied left-to-right (first transformation is applied first).
   *
   * @param b The point to transform
   * @param transforms The transformations to apply in order
   * @returns The transformed point
   */
  point: (b: Point, ...transforms: Transform[]): Point => {
    return transforms.reduce((b, t) => t.apply(b), b);
  }
};

/**
 * A no-operation transformation that returns the input unchanged.
 *
 * Useful as a placeholder or when a transformation is conditionally needed.
 */
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

/** @namespace */
export const TransformFactory = {
  // TODO: Compile transformation as needed
  fromTo: (before: Box, after: Box): Transform[] => {
    if (Box.isEqual(before, after)) return [];

    let scaleX: number;
    let scaleY: number;

    if (isSame(before.w, after.w)) {
      scaleX = 1;
    } else {
      assert.true(before.w !== 0, `Cannot scale by zero width from ${before.w} to ${after.w}`);
      scaleX = after.w / before.w;
    }

    if (isSame(before.h, after.h)) {
      scaleY = 1;
    } else {
      assert.true(before.h !== 0, `Cannot scale by zero height from ${before.h} to ${after.h}`);
      scaleY = after.h / before.h;
    }

    const toOrigin = Translation.toOrigin(before, 'center');
    const translateBack = Translation.toOrigin(after, 'center').invert();

    const transforms: Transform[] = [toOrigin];

    if (scaleX !== 1 || scaleY !== 1) {
      // If both scale and rotation, we need to reset the rotation first
      const hasRotation = after.r !== 0 || before.r !== 0;
      if (hasRotation) transforms.push(Rotation.reset(before));

      transforms.push(new Scale(scaleX, scaleY));

      if (hasRotation) transforms.push(new Rotation(after.r));
    } else {
      const rot = after.r - before.r;
      if (rot !== 0) transforms.push(new Rotation(rot));
    }

    transforms.push(translateBack);

    return transforms;
  },

  rotateAround: (angle: number, centerOfRotation: Point) => {
    return [
      new Translation({ x: -centerOfRotation.x, y: -centerOfRotation.y }),
      new Rotation(angle),
      new Translation({ x: centerOfRotation.x, y: centerOfRotation.y })
    ];
  }
};
