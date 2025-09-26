import type { DiagramEdge } from './diagramEdge';
import { Direction } from '@diagram-craft/geometry/direction';
import { Path } from '@diagram-craft/geometry/path';
import {
  CubicSegment,
  LineSegment,
  PathSegment,
  QuadSegment
} from '@diagram-craft/geometry/pathSegment';
import { Line } from '@diagram-craft/geometry/line';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { buildOrthogonalEdgePath } from './edgePathBuilder.orthogonal';
import { buildBezierEdgePath } from './edgePathBuilder.bezier';
import { buildStraightEdgePath } from './edgePathBuilder.straight';

export const buildEdgePath = (
  edge: DiagramEdge,
  rounding: number,
  startDirection?: Direction,
  endDirection?: Direction
): Path => {
  switch (edge.renderProps.type) {
    case 'orthogonal': {
      const r = buildOrthogonalEdgePath(edge, startDirection, endDirection);
      return rounding > 0 ? Path.from(r, applyRounding(rounding)) : r;
    }
    case 'curved': {
      const r = buildOrthogonalEdgePath(edge, startDirection, endDirection).clean();
      return Path.from(r, convertToCurves);
    }
    case 'bezier':
      return buildBezierEdgePath(edge);

    default: {
      let r = buildStraightEdgePath(edge);
      if (rounding > 0 && r.segments.length > 1) r = Path.from(r, applyRounding(rounding));
      assert.true(r.segments.length > 0, 'Straight edge path must have at least one segment');
      return r;
    }
  }
};

const convertToCurves = (segments: ReadonlyArray<PathSegment>) => {
  const dest: PathSegment[] = [];

  // The idea here is to split every line in half (except the first and the last),
  // and then form a QuadSegment for every pair of lines (with the end of the first
  // as the control point)

  assert.arrayNotEmpty(segments);

  let start = segments[0].start;
  let cp = segments[0].end;
  for (let i = 1; i < segments.length - 1; i++) {
    const segment = segments[i];

    // We know all segments are line segments (as we call this following
    // buildOrthogonalEdgePath)
    if (!(segment instanceof LineSegment)) throw VERIFY_NOT_REACHED();

    const newEnd = Line.midpoint(Line.of(segment.start, segment.end));
    dest.push(new QuadSegment(start, cp, newEnd));

    start = newEnd;
    cp = segment.end;
  }

  dest.push(new QuadSegment(start, cp, segments.at(-1)!.end));

  return dest;
};

const applyRounding = (rounding: number) => (segments: ReadonlyArray<PathSegment>) => {
  const dest: PathSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const previous = i === 0 ? undefined : segments.at(i - 1);
    const segment = segments[i]!;
    const next = segments.at(i + 1);

    const previousIsLine = previous instanceof LineSegment;
    const nextIsLine = next instanceof LineSegment;
    const isLine = segment instanceof LineSegment;

    if (isLine) {
      const line = Line.of(segment.start, segment.end);
      if (previousIsLine && nextIsLine) {
        const s = Line.extend(line, 0, -rounding);
        const n = Line.extend(Line.of(next.start, next.end), -rounding, 0);

        dest.push(new LineSegment(s.from, s.to));
        dest.push(new CubicSegment(s.to, segment.end, segment.end, n.from));
      } else if (previousIsLine) {
        const s = Line.extend(line, -rounding, 0);
        dest.push(new LineSegment(s.from, s.to));
      } else if (nextIsLine) {
        const s = Line.extend(line, 0, -rounding);
        const n = Line.extend(Line.of(next.start, next.end), -rounding, 0);

        dest.push(new LineSegment(s.from, s.to));
        dest.push(new CubicSegment(s.to, segment.end, segment.end, n.from));
      }
    } else {
      dest.push(segment);
    }
  }

  return dest;
};
