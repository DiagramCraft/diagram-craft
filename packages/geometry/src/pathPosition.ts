import { Point } from './point';
import type { Path } from './path';

export type WithSegment<T> = {
  segment: number;
} & T;

export type PointOnPath = {
  point: Point;
};

export type TimeOffsetOnSegment = WithSegment<{ segmentT: number }>;
export type LengthOffsetOnSegment = WithSegment<{ segmentD: number }>;
export type TimeOffsetOnPath = { pathT: number };
export type LengthOffsetOnPath = { pathD: number };

export const PointOnPath = {
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

export const TimeOffsetOnSegment = {
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

export const LengthOffsetOnSegment = {
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

export const TimeOffsetOnPath = {
  toLengthOffsetOnPath: <T extends TimeOffsetOnPath>(p: T, path: Path): LengthOffsetOnPath & T => {
    // TODO: This is incorrect
    const pathD = p.pathT * path.length();
    return {
      ...p,
      pathD
    };
  }
};

export const LengthOffsetOnPath = {
  toTimeOffsetOnSegment: <T extends LengthOffsetOnPath>(
    p: T,
    path: Path
  ): TimeOffsetOnSegment & LengthOffsetOnPath & LengthOffsetOnSegment & T => {
    return LengthOffsetOnSegment.toTimeOffsetOnSegment(
      LengthOffsetOnPath.toLengthOffsetOnSegment(p, path),
      path
    );
  },

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

  toTimeOffsetOnPath: <T extends LengthOffsetOnPath>(p: T, path: Path): TimeOffsetOnPath & T => {
    // TODO: This is incorrect
    const pathT = p.pathD / path.length();
    return {
      ...p,
      pathT
    };
  }
};
