/**
 * Types and utilities for representing positions on paths and converting between different position formats.
 *
 * This module provides several ways to represent a position on a path:
 * - By point coordinates
 * - By parametric time value (t) on a segment or path
 * - By distance (length) along a segment or path
 * - By segment index
 *
 * It also provides conversion functions between these representations.
 *
 * @example
 * ```ts
 * import { PointOnPath, LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
 * import { Path } from '@diagram-craft/geometry/path';
 *
 * const path = new Path({ x: 0, y: 0 }, [
 *   ['L', 100, 0],
 *   ['L', 100, 100]
 * ]);
 *
 * // Convert a point on path to time offset
 * const point = { point: { x: 50, y: 0 } };
 * const timeOffset = PointOnPath.toTimeOffset(point, path);
 * // Result: { point: { x: 50, y: 0 }, segment: 0, segmentT: 0.5, pathD: 50 }
 *
 * // Convert length offset to time offset on segment
 * const lengthOffset = { pathD: 150, segment: 1, segmentD: 50 };
 * const segmentTime = LengthOffsetOnPath.toTimeOffsetOnSegment(lengthOffset, path);
 * // Result includes segmentT for position within the segment
 * ```
 *
 * @module
 */

import { Point } from './point';
import type { Path } from './path';

/**
 * Generic type that adds segment index information to another type.
 *
 * @template T The base type to extend with segment information
 */
export type WithSegment<T> = {
  segment: number;
} & T;

/**
 * Represents a position on a path defined by point coordinates.
 */
export type PointOnPath = {
  point: Point;
};

/**
 * Represents a position using parametric time (t) on a specific segment.
 *
 * The segmentT value ranges from 0 (start of segment) to 1 (end of segment).
 */
export type TimeOffsetOnSegment = WithSegment<{ segmentT: number }>;

/**
 * Represents a position using distance along a specific segment.
 *
 * The segmentD value is the arc length from the segment's start point.
 */
export type LengthOffsetOnSegment = WithSegment<{ segmentD: number }>;

/**
 * Represents a position using parametric time (t) on the entire path.
 *
 * The pathT value ranges from 0 (start of path) to 1 (end of path).
 */
export type TimeOffsetOnPath = { pathT: number };

/**
 * Represents a position using distance along the entire path.
 *
 * The pathD value is the arc length from the path's start point.
 */
export type LengthOffsetOnPath = { pathD: number };

/**
 * Utility functions for working with point-based path positions.
 *
 * @namespace
 */
export const PointOnPath = {
  /**
   * Converts a point on a path to time offset representation.
   *
   * Projects the point onto the path and returns the position as a time offset
   * on a segment along with the path distance.
   *
   * @template T The base type extending PointOnPath
   * @param p The point on path to convert
   * @param path The path to project onto
   * @param limitToUnitT If true, limits the time value to 0-1 range (default: true)
   * @returns The position with time offset, path distance, and segment information
   */
  toTimeOffset: <T extends PointOnPath>(
    p: T,
    path: Path,
    limitToUnitT: boolean = true
  ): TimeOffsetOnSegment & LengthOffsetOnPath & T => {
    const projection = path.projectPoint(p.point, limitToUnitT);
    return {
      ...p,
      segment: projection.segment,
      pathD: projection.pathD,
      segmentT: projection.segmentT
    };
  }
};

/**
 * Utility functions for working with time-offset-based segment positions.
 *
 * @namespace
 */
export const TimeOffsetOnSegment = {
  /**
   * Converts time offset on a segment to length offset on the same segment.
   *
   * @template T The base type extending TimeOffsetOnSegment
   * @param p The time offset position to convert
   * @param path The path containing the segment
   * @returns The position with length offset on the segment
   */
  toLengthOffsetOnSegment: <T extends TimeOffsetOnSegment>(
    p: T,
    path: Path
  ): LengthOffsetOnSegment & T => {
    const segment = path.segments[p.segment]!;
    return {
      ...p,
      segmentD: segment.lengthAtT(p.segmentT)
    };
  }
};

/**
 * Utility functions for working with length-offset-based segment positions.
 *
 * @namespace
 */
export const LengthOffsetOnSegment = {
  /**
   * Converts length offset on a segment to time offset on the same segment.
   *
   * @template T The base type extending LengthOffsetOnSegment
   * @param p The length offset position to convert
   * @param path The path containing the segment
   * @returns The position with time offset on the segment
   */
  toTimeOffsetOnSegment: <T extends LengthOffsetOnSegment>(
    p: T,
    path: Path
  ): TimeOffsetOnSegment & T => {
    const segment = path.segments[p.segment]!;
    return {
      ...p,
      segmentT: segment.tAtLength(p.segmentD)
    };
  }
};

/**
 * Utility functions for working with time-offset-based path positions.
 *
 * @namespace
 */
export const TimeOffsetOnPath = {
  /**
   * Converts time offset on a path to length offset on the path.
   *
   * Note: This implementation uses a linear approximation and may not be accurate for
   * paths with variable curvature.
   *
   * @template T The base type extending TimeOffsetOnPath
   * @param p The time offset position to convert
   * @param path The path
   * @returns The position with length offset on the path
   */
  toLengthOffsetOnPath: <T extends TimeOffsetOnPath>(p: T, path: Path): LengthOffsetOnPath & T => {
    // TODO: This is incorrect
    const pathD = p.pathT * path.length();
    return {
      ...p,
      pathD
    };
  }
};

/**
 * Utility functions for working with length-offset-based path positions.
 *
 * @namespace
 */
export const LengthOffsetOnPath = {
  /**
   * Converts length offset on a path to time offset on the containing segment.
   *
   * First determines which segment contains the position at the given path distance,
   * then converts to time offset on that segment.
   *
   * @template T The base type extending LengthOffsetOnPath
   * @param p The length offset position on the path
   * @param path The path
   * @returns The position with time offset on segment, length offsets, and segment information
   */
  toTimeOffsetOnSegment: <T extends LengthOffsetOnPath>(
    p: T,
    path: Path
  ): TimeOffsetOnSegment & LengthOffsetOnPath & LengthOffsetOnSegment & T => {
    return LengthOffsetOnSegment.toTimeOffsetOnSegment(
      LengthOffsetOnPath.toLengthOffsetOnSegment(p, path),
      path
    );
  },

  /**
   * Converts length offset on a path to length offset on the containing segment.
   *
   * Finds which segment contains the position at the given path distance and calculates
   * the distance from that segment's start point.
   *
   * @template T The base type extending LengthOffsetOnPath
   * @param p The length offset position on the path
   * @param path The path
   * @returns The position with length offset on the segment and segment information
   */
  toLengthOffsetOnSegment: <T extends LengthOffsetOnPath>(
    p: T,
    path: Path
  ): LengthOffsetOnSegment & T => {
    let idx = 0;
    let len = 0;
    while (len < p.pathD && idx < path.segments.length) {
      const newLen = len + path.segments[idx]!.length();
      if (newLen >= p.pathD) {
        break;
      }
      len = newLen;
      idx++;
    }

    return {
      ...p,
      p: path.segments.length,
      segment: idx,
      segmentD: p.pathD - len
    };
  },

  /**
   * Converts length offset on a path to time offset on the path.
   *
   * Note: This implementation uses a linear approximation and may not be accurate for
   * paths with variable curvature.
   *
   * @template T The base type extending LengthOffsetOnPath
   * @param p The length offset position
   * @param path The path
   * @returns The position with time offset on the path
   */
  toTimeOffsetOnPath: <T extends LengthOffsetOnPath>(p: T, path: Path): TimeOffsetOnPath & T => {
    // TODO: This is incorrect
    const pathT = p.pathD / path.length();
    return {
      ...p,
      pathT
    };
  }
};
