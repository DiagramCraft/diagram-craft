import { Point } from './point.ts';
import { Path } from './path.ts';

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
    path: Path
  ): TimeOffsetOnSegment & LengthOffsetOnPath & T => {
    const projection = path.projectPoint(p.point);
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
    const segment = path.segments[p.segment];
    return {
      ...p,
      segmentD: segment.lengthAtT(p.segmentT)
    };
  },
  toLengthOffsetOnPath: <T extends TimeOffsetOnSegment>(
    p: T,
    path: Path
  ): LengthOffsetOnPath & T => {
    const segment = path.segments[p.segment];
    // TODO: This is incorrect
    const pathD = path.lengthTo(p.segment) + p.segmentT * segment.length();
    return {
      ...p,
      pathD
    };
  },
  toPointOnPath: <T extends TimeOffsetOnSegment>(p: T, path: Path): PointOnPath & T => {
    const segment = path.segments[p.segment];
    return {
      ...p,
      point: segment.point(p.segmentT)
    };
  }
};

export const LengthOffsetOnSegment = {
  toTimeOffsetOnSegment: <T extends LengthOffsetOnSegment>(
    p: T,
    path: Path
  ): TimeOffsetOnSegment & T => {
    const segment = path.segments[p.segment];
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
  toLengthOffsetOnSegment: <T extends LengthOffsetOnPath>(
    p: T,
    path: Path
  ): LengthOffsetOnSegment & T => {
    let idx = 0;
    let len = 0;
    while (len < p.pathD) {
      len += path.segments[idx]!.length();
      idx++;
    }

    return {
      ...p,
      segment: idx,
      segmentD: len - p.pathD
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
