import { Point } from './point.ts';
import {
  ArcSegment,
  CubicSegment,
  LineSegment,
  makeCurveSegment,
  PathSegment,
  QuadSegment,
  SegmentList
} from './pathSegment.ts';
import { VerifyNotReached } from '../utils/assert.ts';
import {
  LengthOffsetOnPath,
  PointOnPath,
  TimeOffsetOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from './pathPosition.ts';
import { Segment } from './pathBuilder.ts';

export type Projection = { t: number; distance: number; point: Point };

export type Accuracy = 'speed' | 'precision';

const makeSegmentList = (start: Point, path: Segment[]) => {
  const dest: PathSegment[] = [];

  let end = start;

  for (const seg of path) {
    const command = seg[0];

    let s: PathSegment;
    switch (command) {
      case 'L':
        s = new LineSegment(end, { x: seg[1], y: seg[2] });
        break;
      case 'C':
        s = new CubicSegment(
          end,
          { x: seg[1], y: seg[2] },
          { x: seg[3], y: seg[4] },
          { x: seg[5], y: seg[6] }
        );
        break;
      case 'Q':
        s = new QuadSegment(end, { x: seg[1], y: seg[2] }, { x: seg[3], y: seg[4] });
        break;
      case 'T':
        s = makeCurveSegment(end, { x: seg[1], y: seg[2] }, dest.at(-1)! as QuadSegment);
        break;
      case 'A':
        // TODO: Remove this ts-ignore
        // @ts-ignore
        s = new ArcSegment(end, seg[1], seg[2], seg[3], seg[4], seg[5], {
          x: seg[6],
          y: seg[7]
        });
        break;

      default:
        throw new VerifyNotReached();
    }
    dest.push(s);
    end = s.end;
  }

  return new SegmentList(dest);
};

// TODO: I wonder if we should create the segmentList immediately and not keep the path around
export class Path {
  private readonly path: Segment[] = [];
  private readonly start: Point;
  private _segmentList: SegmentList | undefined;

  constructor(path: Segment[], start: Point) {
    this.path = path;
    this.start = start;
  }

  private get segmentList() {
    if (this._segmentList) return this._segmentList;
    this._segmentList = makeSegmentList(this.start, this.path);
    return this._segmentList;
  }

  get segments(): PathSegment[] {
    return this.segmentList.segments;
  }

  length() {
    return this.segmentList.length();
  }

  lengthTo(idx: number) {
    return this.segments.slice(0, idx).reduce((acc, cur) => acc + cur.length(), 0);
  }

  pointAt(t: LengthOffsetOnPath, _mode: Accuracy = 'speed') {
    return this.segmentList.pointAt(t, _mode);
  }

  projectPoint(point: Point): PointOnPath & TimeOffsetOnPath & TimeOffsetOnSegment {
    const projection = this.segmentList.projectPoint(point);

    return {
      pathT: projection.globalT,
      segmentT: projection.t,
      point: projection.point,
      segment: projection.segmentIndex
    };
  }

  intersections(other: Path): WithSegment<PointOnPath>[] {
    const dest: WithSegment<PointOnPath>[] = [];

    const segments = this.segments;
    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx];
      for (const otherSegment of other.segments) {
        const intersections = segment.intersectionsWith(otherSegment);
        if (intersections) {
          dest.push(
            ...intersections.map(i => {
              return {
                point: i,
                segment: idx
              };
            })
          );
        }
      }
    }

    return dest;
  }

  split(p1: TimeOffsetOnSegment, p2?: TimeOffsetOnSegment): Path[] {
    const dest: Path[] = [];
    const startSegments = this.segments[p1.segment].split(p1.segmentT);

    dest.push(
      new Path([...this.path.slice(0, p1.segment), ...startSegments[0].asRawSegments()], this.start)
    );
    if (p2) {
      const endSegments = p2 ? this.segments[p2.segment].split(p2.segmentT) : [];
      dest.push(
        new Path(
          [
            ...startSegments[1].asRawSegments(),
            ...this.path.slice(p1.segment + 1, p2.segment),
            ...endSegments[0].asRawSegments()
          ],
          startSegments[1].start
        )
      );
      dest.push(
        new Path(
          [...endSegments[1].asRawSegments(), ...this.path.slice(p2.segment)],
          endSegments[1].start
        )
      );
    } else {
      dest.push(
        new Path(
          [...startSegments[1].asRawSegments(), ...this.path.slice(p1.segment)],
          startSegments[1].start
        )
      );
    }

    return dest;
  }

  asSvgPath(normalized = false) {
    if (normalized) {
      return (
        `M ${this.start.x} ${this.start.y} ` +
        this.segments
          .map(e => e.normalize())
          .flat()
          .join(' ')
      );
    } else {
      return `M ${this.start.x} ${this.start.y} ` + this.path.map(e => e.join(' ')).join(' ');
    }
  }
}
