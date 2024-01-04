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

        let minA = Number.MAX_SAFE_INTEGER;
        let maxA = Number.MIN_SAFE_INTEGER;
        let minB = Number.MAX_SAFE_INTEGER;
        let maxB = Number.MIN_SAFE_INTEGER;

        for (const p of a.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (projected < minA) minA = projected;
          if (projected > maxA) maxA = projected;
        }

        for (const p of b.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (projected < minB) minB = projected;
          if (projected > maxB) maxB = projected;
        }

        if (maxA < minB || maxB < minA) return false;
      }
    }
    return true;
  },

  contains: (polygon: Polygon, testPoint: Point) => {
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
