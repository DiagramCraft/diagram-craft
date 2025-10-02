import type { DiagramEdge } from './diagramEdge';
import { Direction } from '@diagram-craft/geometry/direction';
import { Path } from '@diagram-craft/geometry/path';
import { LineSegment, PathSegment, QuadSegment } from '@diagram-craft/geometry/pathSegment';
import { Line } from '@diagram-craft/geometry/line';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import { buildOrthogonalEdgePath } from './edgePathBuilder.orthogonal';
import { buildBezierEdgePath } from './edgePathBuilder.bezier';
import { buildStraightEdgePath } from './edgePathBuilder.straight';

export const buildEdgePath = (
  edge: DiagramEdge,
  startDirection?: Direction,
  endDirection?: Direction
): Path => {
  switch (edge.renderProps.type) {
    case 'orthogonal': {
      return buildOrthogonalEdgePath(edge, startDirection, endDirection);
    }
    case 'curved': {
      const r = buildOrthogonalEdgePath(edge, startDirection, endDirection).clean();
      return Path.from(r, convertToCurves);
    }
    case 'bezier':
      return buildBezierEdgePath(edge);

    default: {
      return buildStraightEdgePath(edge);
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
    if (!(segment instanceof LineSegment)) throw new VerifyNotReached();

    const newEnd = Line.midpoint(Line.of(segment.start, segment.end));
    dest.push(new QuadSegment(start, cp, newEnd));

    start = newEnd;
    cp = segment.end;
  }

  dest.push(new QuadSegment(start, cp, segments.at(-1)!.end));

  return dest;
};
