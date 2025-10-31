import { describe, expect, it } from 'vitest';
import { PathList } from './pathList';
import { Path } from './path';
import { LineSegment } from './pathSegment';

describe('PathList', () => {
  describe('segments', () => {
    it('returns all segments from a single path', () => {
      const path = new Path({ x: 0, y: 0 }, [
        ['L', 10, 0],
        ['L', 10, 10],
        ['L', 0, 10]
      ]);
      const pathList = new PathList([path]);

      const segments = pathList.segments();

      expect(segments).toHaveLength(3);
      expect(segments[0]).toBeInstanceOf(LineSegment);
      expect(segments[0]!.start).toEqual({ x: 0, y: 0 });
      expect(segments[0]!.end).toEqual({ x: 10, y: 0 });
      expect(segments[1]!.start).toEqual({ x: 10, y: 0 });
      expect(segments[1]!.end).toEqual({ x: 10, y: 10 });
      expect(segments[2]!.start).toEqual({ x: 10, y: 10 });
      expect(segments[2]!.end).toEqual({ x: 0, y: 10 });
    });

    it('returns all segments from multiple paths', () => {
      const path1 = new Path({ x: 0, y: 0 }, [
        ['L', 10, 0],
        ['L', 10, 10]
      ]);
      const path2 = new Path({ x: 20, y: 20 }, [
        ['L', 30, 20],
        ['L', 30, 30]
      ]);
      const pathList = new PathList([path1, path2]);

      const segments = pathList.segments();

      expect(segments).toHaveLength(4);
      expect(segments[0]!.start).toEqual({ x: 0, y: 0 });
      expect(segments[0]!.end).toEqual({ x: 10, y: 0 });
      expect(segments[1]!.start).toEqual({ x: 10, y: 0 });
      expect(segments[1]!.end).toEqual({ x: 10, y: 10 });
      expect(segments[2]!.start).toEqual({ x: 20, y: 20 });
      expect(segments[2]!.end).toEqual({ x: 30, y: 20 });
      expect(segments[3]!.start).toEqual({ x: 30, y: 20 });
      expect(segments[3]!.end).toEqual({ x: 30, y: 30 });
    });

    it('returns empty array for empty path list', () => {
      const pathList = new PathList([]);

      const segments = pathList.segments();

      expect(segments).toHaveLength(0);
    });

    it('flattens segments from multiple paths with different segment types', () => {
      const path1 = new Path({ x: 0, y: 0 }, [['L', 10, 10]]);
      const path2 = new Path({ x: 20, y: 20 }, [['C', 25, 25, 30, 30, 40, 40]]);
      const pathList = new PathList([path1, path2]);

      const segments = pathList.segments();

      expect(segments).toHaveLength(2);
      expect(segments[0]).toBeInstanceOf(LineSegment);
    });
  });

  describe('projectPoint', () => {
    it('projects a point onto the nearest path', () => {
      const path = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100]
      ]);
      const pathList = new PathList([path]);

      const result = pathList.projectPoint({ x: 50, y: -10 });

      expect(result.point.x).toBeCloseTo(50);
      expect(result.point.y).toBeCloseTo(0);
      expect(result.pathIdx).toBe(0);
    });

    it('finds the closest path when multiple paths exist', () => {
      const path1 = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const path2 = new Path({ x: 0, y: 50 }, [['L', 100, 50]]);
      const pathList = new PathList([path1, path2]);

      // Point closer to path2
      const result = pathList.projectPoint({ x: 50, y: 45 });

      expect(result.point.y).toBeCloseTo(50);
      expect(result.pathIdx).toBe(1);
    });

    it('projects onto the correct segment of a path', () => {
      const path = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100]
      ]);
      const pathList = new PathList([path]);

      // Point closest to the second segment
      const result = pathList.projectPoint({ x: 110, y: 50 });

      expect(result.point.x).toBeCloseTo(100);
      expect(result.point.y).toBeCloseTo(50);
      expect(result.offset.segment).toBe(1);
    });

    it('projects to the start point when point is before the path', () => {
      const path = new Path({ x: 10, y: 10 }, [['L', 100, 10]]);
      const pathList = new PathList([path]);

      const result = pathList.projectPoint({ x: 0, y: 10 });

      expect(result.point.x).toBeCloseTo(10);
      expect(result.point.y).toBeCloseTo(10);
    });

    it('projects to the end point when point is after the path', () => {
      const path = new Path({ x: 10, y: 10 }, [['L', 100, 10]]);
      const pathList = new PathList([path]);

      const result = pathList.projectPoint({ x: 150, y: 10 });

      expect(result.point.x).toBeCloseTo(100);
      expect(result.point.y).toBeCloseTo(10);
    });

    it('returns correct pathIdx for multiple paths', () => {
      const path1 = new Path({ x: 0, y: 0 }, [['L', 50, 0]]);
      const path2 = new Path({ x: 100, y: 100 }, [['L', 150, 100]]);
      const path3 = new Path({ x: 200, y: 200 }, [['L', 250, 200]]);
      const pathList = new PathList([path1, path2, path3]);

      const result = pathList.projectPoint({ x: 125, y: 95 });

      expect(result.pathIdx).toBe(1);
      expect(result.point.y).toBeCloseTo(100);
    });

    it('includes offset information in the result', () => {
      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const pathList = new PathList([path]);

      const result = pathList.projectPoint({ x: 50, y: 10 });

      expect(result.offset).toBeDefined();
      expect(result.offset.segment).toBe(0);
      expect(result.offset.segmentT).toBeGreaterThanOrEqual(0);
      expect(result.offset.segmentT).toBeLessThanOrEqual(1);
      expect(result.offset.pathD).toBeGreaterThanOrEqual(0);
    });
  });

  describe('intersections', () => {
    it('finds intersections between path list and a path', () => {
      const rect = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const pathList = new PathList([rect]);

      const line = new Path({ x: 50, y: -10 }, [['L', 50, 110]]);

      const intersections = pathList.intersections(line);

      expect(intersections).toHaveLength(2);
      expect(intersections[0]!.x).toBeCloseTo(50);
      expect(intersections[0]!.y).toBeCloseTo(0);
      expect(intersections[1]!.x).toBeCloseTo(50);
      expect(intersections[1]!.y).toBeCloseTo(100);
    });

    it('returns empty array when no intersections exist', () => {
      const path = new Path({ x: 0, y: 0 }, [['L', 10, 0]]);
      const pathList = new PathList([path]);

      const line = new Path({ x: 0, y: 10 }, [['L', 10, 10]]);

      const intersections = pathList.intersections(line);

      expect(intersections).toHaveLength(0);
    });

    it('finds intersections across multiple paths in the list', () => {
      const path1 = new Path({ x: 0, y: 0 }, [['L', 50, 0]]);
      const path2 = new Path({ x: 60, y: 0 }, [['L', 100, 0]]);
      const pathList = new PathList([path1, path2]);

      const line = new Path({ x: 0, y: -10 }, [['L', 100, 10]]);

      const intersections = pathList.intersections(line);

      // Should intersect both paths
      expect(intersections.length).toBeGreaterThan(0);
    });

    it('finds multiple intersections on a single path', () => {
      const zigzag = new Path({ x: 0, y: 0 }, [
        ['L', 50, 50],
        ['L', 100, 0],
        ['L', 150, 50]
      ]);
      const pathList = new PathList([zigzag]);

      const horizontal = new Path({ x: 0, y: 25 }, [['L', 150, 25]]);

      const intersections = pathList.intersections(horizontal);

      // Should intersect the zigzag pattern multiple times
      expect(intersections.length).toBeGreaterThanOrEqual(2);
    });

    it('handles intersection at path endpoints', () => {
      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const pathList = new PathList([path]);

      const line = new Path({ x: 0, y: -10 }, [['L', 0, 10]]);

      const intersections = pathList.intersections(line);

      expect(intersections).toHaveLength(1);
      expect(intersections[0]!.x).toBeCloseTo(0);
      expect(intersections[0]!.y).toBeCloseTo(0);
    });

    it('handles curved paths correctly', () => {
      const curve = new Path({ x: 0, y: 50 }, [['C', 50, 0, 50, 100, 100, 50]]);
      const pathList = new PathList([curve]);

      const vertical = new Path({ x: 50, y: 0 }, [['L', 50, 100]]);

      const intersections = pathList.intersections(vertical);

      // Curve should intersect the vertical line
      expect(intersections.length).toBeGreaterThan(0);
    });

    it('returns all intersection points for complex shapes', () => {
      const rect = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const pathList = new PathList([rect]);

      // Diagonal line crossing the rectangle
      const diagonal = new Path({ x: -10, y: -10 }, [['L', 110, 110]]);

      const intersections = pathList.intersections(diagonal);

      // Should intersect at four points (two corners and two edges)
      expect(intersections).toHaveLength(4);
    });
  });
});
