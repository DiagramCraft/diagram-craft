// pathSegment.test.ts
import { describe, expect, it } from 'vitest';
import { LineSegment } from './pathSegment';

describe('LineSegment', () => {
  describe('projectPoint', () => {
    it('should project a point directly onto the line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 5, y: 0 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 5, y: 0 });
      expect(result.t).toBeCloseTo(0.5);
      expect(result.distance).toBeCloseTo(0);
    });

    it('should project a point above the line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 5, y: 5 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 5, y: 0 });
      expect(result.t).toBeCloseTo(0.5);
      expect(result.distance).toBeCloseTo(5);
    });

    it('should project a point outside the start of the line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: -5, y: 0 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 0, y: 0 });
      expect(result.t).toBeCloseTo(0);
      expect(result.distance).toBeCloseTo(5);
    });

    it('should project a point outside the end of the line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 15, y: 0 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 10, y: 0 });
      expect(result.t).toBeCloseTo(1);
      expect(result.distance).toBeCloseTo(5);
    });

    it('should project a point onto a diagonal line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 10, y: 10 });
      const point = { x: 5, y: 0 };
      const result = line.projectPoint(point);

      expect(result.point.x).toBeCloseTo(2.5);
      expect(result.point.y).toBeCloseTo(2.5);
      expect(result.t).toBeCloseTo(0.25);
      expect(result.distance).toBeCloseTo(Math.sqrt(12.5));
    });

    it('should project a point onto a vertical line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 0, y: 10 });
      const point = { x: 0, y: 5 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 0, y: 5 });
      expect(result.t).toBeCloseTo(0.5);
      expect(result.distance).toBeCloseTo(0);
    });

    it('should project a point to the left of a vertical line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 0, y: 10 });
      const point = { x: -5, y: 5 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 0, y: 5 });
      expect(result.t).toBeCloseTo(0.5);
      expect(result.distance).toBeCloseTo(5);
    });

    it('should project a point above a vertical line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 0, y: 10 });
      const point = { x: 0, y: 15 };
      const result = line.projectPoint(point);

      expect(result.t).toBeCloseTo(1);
      expect(result.point).toEqual({ x: 0, y: 10 });
      expect(result.distance).toBeCloseTo(5);
    });

    it('should project a point below a vertical line segment', () => {
      const line = new LineSegment({ x: 0, y: 0 }, { x: 0, y: 10 });
      const point = { x: 0, y: -5 };
      const result = line.projectPoint(point);

      expect(result.point).toEqual({ x: 0, y: 0 });
      expect(result.t).toBeCloseTo(0);
      expect(result.distance).toBeCloseTo(5);
    });
  });
});
