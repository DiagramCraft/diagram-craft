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
import { PathPosition } from './pathPosition.ts';
import { Segment } from './pathBuilder.ts';

export type Projection = { t: number; distance: number; point: Point };

export type Accuracy = 'speed' | 'precision';

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

    const dest: PathSegment[] = [];

    let end = this.start;

    for (const seg of this.path) {
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

    this._segmentList = new SegmentList(dest);
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

  // TODO: Change to PathPosition
  pointAtLength(t: number, _mode: Accuracy = 'speed') {
    return this.segmentList.pointAtLength(t, _mode);
  }

  projectPoint(point: Point): PathPosition {
    const projection = this.segmentList.projectPoint(point);

    const pathPosition = new PathPosition();
    pathPosition.globalT = projection.globalT;
    pathPosition.point = projection.point;
    pathPosition.segmentIndex = projection.segmentIndex;
    pathPosition.localT = projection.t;
    pathPosition.path = this;
    return pathPosition;
  }

  intersections(other: Path): PathPosition[] {
    const dest: PathPosition[] = [];

    for (let idx = 0; idx < this.segments.length; idx++) {
      const segment = this.segments[idx];
      for (const otherSegment of other.segments) {
        const intersections = segment.intersectionsWith(otherSegment);
        if (intersections) {
          dest.push(
            ...intersections.map(i => {
              const pos = new PathPosition();
              pos.point = i;
              pos.segmentIndex = idx;
              pos.path = this;
              return pos;
            })
          );
        }
      }
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
