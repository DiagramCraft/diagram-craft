import { invariant, precondition } from '../utils/assert.ts';
import { Point } from './point.ts';
import { Vector } from './vector.ts';

export type Polygon = {
  points: Point[];
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
