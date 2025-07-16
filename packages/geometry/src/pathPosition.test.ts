import { describe, expect, test } from 'vitest';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnPath,
  TimeOffsetOnSegment
} from './pathPosition';
import { Path } from './path';

describe('pathPosition', () => {
  // Create a simple path with two line-segments for testing
  const createTestPath = () => {
    const start = { x: 0, y: 0 };
    return new Path(start, [
      ['L', 10, 0],
      ['L', 10, 10]
    ]);
  };

  // Create a path with a curve segment for testing
  const createCurvePath = () => {
    const start = { x: 0, y: 0 };
    return new Path(start, [['C', 5, -5, 15, 5, 20, 0]]);
  };

  describe('PointOnPath', () => {
    test('toTimeOffset should convert a point to time offset', () => {
      const path = createTestPath();
      const point = { x: 5, y: 0 };

      const result = PointOnPath.toTimeOffset({ point }, path);

      expect(result.segment).toBe(0);
      expect(result.pathD).toBeCloseTo(5);
      expect(result.segmentT).toBeCloseTo(0.5);
    });

    test('toTimeOffset should handle points not exactly on the path', () => {
      const path = createTestPath();
      const point = { x: 5, y: 1 }; // Slightly off the path

      const result = PointOnPath.toTimeOffset({ point }, path);

      expect(result.segment).toBe(0);
      // The projected point should be at (5, 0)
      expect(result.pathD).toBeCloseTo(5);
      expect(result.segmentT).toBeCloseTo(0.5);
    });

    test('toTimeOffset should work with curved paths', () => {
      const path = createCurvePath();
      const point = { x: 10, y: 0 }; // Point on the curve

      const result = PointOnPath.toTimeOffset({ point }, path);

      expect(result.segment).toBe(0);
      // The exact pathD and segmentT values depend on the curve's parameterization
      expect(result.pathD).toBeGreaterThan(0);
      expect(result.segmentT).toBeGreaterThan(0);
      expect(result.segmentT).toBeLessThan(1);
    });
  });

  describe('TimeOffsetOnSegment', () => {
    test('toLengthOffsetOnSegment should convert time to length', () => {
      const path = createTestPath();
      const timeOffset = { segment: 0, segmentT: 0.5 };

      const result = TimeOffsetOnSegment.toLengthOffsetOnSegment(timeOffset, path);

      expect(result.segment).toBe(0);
      expect(result.segmentT).toBe(0.5);
      expect(result.segmentD).toBeCloseTo(5); // Half of the first segment length
    });

    test('toLengthOffsetOnSegment should handle t=0 and t=1', () => {
      const path = createTestPath();

      const resultStart = TimeOffsetOnSegment.toLengthOffsetOnSegment(
        { segment: 0, segmentT: 0 },
        path
      );
      expect(resultStart.segmentD).toBeCloseTo(0);

      const resultEnd = TimeOffsetOnSegment.toLengthOffsetOnSegment(
        { segment: 0, segmentT: 1 },
        path
      );
      expect(resultEnd.segmentD).toBeCloseTo(10);
    });

    test('toLengthOffsetOnSegment should work with curved paths', () => {
      const path = createCurvePath();
      const timeOffset = { segment: 0, segmentT: 0.5 };

      const result = TimeOffsetOnSegment.toLengthOffsetOnSegment(timeOffset, path);

      expect(result.segment).toBe(0);
      expect(result.segmentT).toBe(0.5);
      // The exact segmentD value depends on the curve's parameterization
      expect(result.segmentD).toBeGreaterThan(0);
    });
  });

  describe('LengthOffsetOnSegment', () => {
    test('toTimeOffsetOnSegment should convert length to time', () => {
      const path = createTestPath();
      const lengthOffset = { segment: 0, segmentD: 5 };

      const result = LengthOffsetOnSegment.toTimeOffsetOnSegment(lengthOffset, path);

      expect(result.segment).toBe(0);
      expect(result.segmentD).toBe(5);
      expect(result.segmentT).toBeCloseTo(0.5); // Half of the first segment
    });

    test('toTimeOffsetOnSegment should handle d=0 and d=length', () => {
      const path = createTestPath();

      const resultStart = LengthOffsetOnSegment.toTimeOffsetOnSegment(
        { segment: 0, segmentD: 0 },
        path
      );
      expect(resultStart.segmentT).toBeCloseTo(0);

      const resultEnd = LengthOffsetOnSegment.toTimeOffsetOnSegment(
        { segment: 0, segmentD: 10 },
        path
      );
      expect(resultEnd.segmentT).toBeCloseTo(1);
    });

    test('toTimeOffsetOnSegment should work with curved paths', () => {
      const path = createCurvePath();
      // Get the length of the curve segment
      const curveLength = path.segments[0].length();
      const lengthOffset = { segment: 0, segmentD: curveLength / 2 };

      const result = LengthOffsetOnSegment.toTimeOffsetOnSegment(lengthOffset, path);

      expect(result.segment).toBe(0);
      expect(result.segmentD).toBeCloseTo(curveLength / 2);
      // The exact segmentT value depends on the curve's parameterization
      expect(result.segmentT).toBeGreaterThan(0);
      expect(result.segmentT).toBeLessThan(1);
    });
  });

  describe('TimeOffsetOnPath', () => {
    test('toLengthOffsetOnPath should convert path time to path length', () => {
      const path = createTestPath();
      const timeOffset = { pathT: 0.5 };

      const result = TimeOffsetOnPath.toLengthOffsetOnPath(timeOffset, path);

      expect(result.pathT).toBe(0.5);
      expect(result.pathD).toBeCloseTo(10); // Half of the total path length (20)
    });

    test('toLengthOffsetOnPath should handle t=0 and t=1', () => {
      const path = createTestPath();

      const resultStart = TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: 0 }, path);
      expect(resultStart.pathD).toBeCloseTo(0);

      const resultEnd = TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: 1 }, path);
      expect(resultEnd.pathD).toBeCloseTo(20); // Total path length
    });

    test('toLengthOffsetOnPath should work with curved paths', () => {
      const path = createCurvePath();
      const timeOffset = { pathT: 0.5 };

      const result = TimeOffsetOnPath.toLengthOffsetOnPath(timeOffset, path);

      expect(result.pathT).toBe(0.5);
      // The exact pathD value depends on the curve's length
      const totalLength = path.length();
      expect(result.pathD).toBeCloseTo(totalLength / 2);
    });
  });

  describe('LengthOffsetOnPath', () => {
    test('toTimeOffsetOnSegment should convert path length to segment time', () => {
      const path = createTestPath();
      const lengthOffset = { pathD: 5 };

      const result = LengthOffsetOnPath.toTimeOffsetOnSegment(lengthOffset, path);

      expect(result.pathD).toBe(5);
      expect(result.segment).toBe(0);
      expect(result.segmentD).toBeCloseTo(5);
      expect(result.segmentT).toBeCloseTo(0.5);
    });

    test('toLengthOffsetOnSegment should convert path length to segment length', () => {
      const path = createTestPath();
      const lengthOffset = { pathD: 15 };

      const result = LengthOffsetOnPath.toLengthOffsetOnSegment(lengthOffset, path);

      expect(result.pathD).toBe(15);
      expect(result.segment).toBe(1);
      expect(result.segmentD).toBeCloseTo(5); // 5 units into the second segment
    });

    test('toTimeOffsetOnPath should convert path length to path time', () => {
      const path = createTestPath();
      const lengthOffset = { pathD: 10 };

      const result = LengthOffsetOnPath.toTimeOffsetOnPath(lengthOffset, path);

      expect(result.pathD).toBe(10);
      expect(result.pathT).toBeCloseTo(0.5); // Half of the total path length
    });

    test('toTimeOffsetOnSegment should work with curved paths', () => {
      const path = createCurvePath();
      const totalLength = path.length();
      const lengthOffset = { pathD: totalLength / 2 };

      const result = LengthOffsetOnPath.toTimeOffsetOnSegment(lengthOffset, path);

      expect(result.pathD).toBeCloseTo(totalLength / 2);
      expect(result.segment).toBe(0);
      expect(result.segmentD).toBeCloseTo(totalLength / 2);
      // The exact segmentT value depends on the curve's parameterization
      expect(result.segmentT).toBeGreaterThan(0);
      expect(result.segmentT).toBeLessThan(1);
    });

    test('toTimeOffsetOnPath should work with curved paths', () => {
      const path = createCurvePath();
      const totalLength = path.length();
      const lengthOffset = { pathD: totalLength / 2 };

      const result = LengthOffsetOnPath.toTimeOffsetOnPath(lengthOffset, path);

      expect(result.pathD).toBeCloseTo(totalLength / 2);
      expect(result.pathT).toBeCloseTo(0.5);
    });
  });
});
