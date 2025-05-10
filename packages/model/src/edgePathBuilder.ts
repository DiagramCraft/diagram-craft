import { DiagramEdge } from './diagramEdge';
import { ControlPoints, Waypoint } from './types';
import { Direction } from '@diagram-craft/geometry/direction';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Path } from '@diagram-craft/geometry/path';
import {
  CubicSegment,
  LineSegment,
  PathSegment,
  QuadSegment
} from '@diagram-craft/geometry/pathSegment';
import { Line } from '@diagram-craft/geometry/line';
import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { ConnectedEndpoint } from './endpoint';
import { Box } from '@diagram-craft/geometry/box';

type Result = {
  startDirection: Direction;
  endDirection: Direction;
  path: PathListBuilder;
  availableDirections: ReadonlyArray<Direction>;
  preferredDirection: ReadonlyArray<Direction>;
};

const addSegment = (
  prevWP: Waypoint,
  thisWP: Waypoint,
  availableDirections: ReadonlyArray<Direction>,
  preferredDirection: ReadonlyArray<Direction>
): Result[] => {
  const { x: px, y: py } = prevWP.point;
  const { x: x, y: y } = thisWP.point;

  const isAvailable = (d: Direction) => {
    if (d === 's' && y > py) return true;
    if (d === 'n' && y < py) return true;
    if (d === 'e' && x > px) return true;
    return d === 'w' && x < px;
  };
  const dirInOrder = unique([
    ...preferredDirection.filter(isAvailable),
    ...availableDirections.filter(isAvailable),
    ...availableDirections
  ]);

  return dirInOrder
    .flatMap(direction => {
      const makeEntry = (p: PathListBuilder, endDirection: Direction): Result => ({
        startDirection: direction,
        endDirection,
        path: p,
        availableDirections: [],
        preferredDirection: []
      });

      switch (direction) {
        case 'n':
        case 's': {
          const full = new PathListBuilder();
          full.lineTo({ x: px, y });
          full.lineTo({ x, y });

          const half = new PathListBuilder();
          half.lineTo({ x: px, y: py + (y - py) / 2 });
          half.lineTo({ x, y: py + (y - py) / 2 });
          half.lineTo({ x, y });

          return [makeEntry(full, x < px ? 'w' : 'e'), makeEntry(half, y < py ? 'n' : 's')];
        }
        case 'e':
        case 'w': {
          const full = new PathListBuilder();
          full.lineTo({ x, y: py });
          full.lineTo({ x, y });

          const half = new PathListBuilder();
          half.lineTo({ x: px + (x - px) / 2, y: py });
          half.lineTo({ x: px + (x - px) / 2, y });
          half.lineTo({ x, y });

          return [makeEntry(full, y < py ? 'n' : 's'), makeEntry(half, x < px ? 'w' : 'e')];
        }
      }
    })
    .map(entry => {
      // We need to make sure we are not going back the same way
      // we entered the waypoint
      const backDirection = Direction.opposite(entry.endDirection);
      entry.availableDirections = Direction.all().filter(d => d !== backDirection);
      entry.preferredDirection = [entry.endDirection];
      return entry;
    });
};

/*
 * In case an edge is connected to the central point of a node, orthogonal routed edges
 * connects to the closest point on the bounding box of the node instead of the center
 *
 * This function adjusts the connection point to the closest point on the bounding box
 */
const readjustConnectionPoint = (p: Point, wp: Point, startBounds: Box) => {
  if (wp.x >= startBounds.x && wp.x <= startBounds.x + startBounds.w) {
    p = {
      x: wp.x,
      y: wp.y > startBounds.y + startBounds.h / 2 ? startBounds.y + startBounds.h : startBounds.y
    };
  } else if (wp.y >= startBounds.y && wp.y <= startBounds.y + startBounds.h) {
    p = {
      x: wp.x > startBounds.x + startBounds.w / 2 ? startBounds.x + startBounds.w : startBounds.x,
      y: wp.y
    };
  }
  return p;
};

const buildOrthogonalEdgePath = (
  edge: DiagramEdge,
  preferredStartDirection: Direction | undefined,
  preferredEndDirection: Direction | undefined
) => {
  let sm = edge.start.position;
  let em = edge.end.position;

  if (
    edge.start instanceof ConnectedEndpoint &&
    edge.start.isMidpoint() &&
    edge.waypoints.length > 0
  ) {
    sm = readjustConnectionPoint(sm, edge.waypoints[0].point, edge.start.node.bounds);
  }

  if (edge.end instanceof ConnectedEndpoint && edge.end.isMidpoint() && edge.waypoints.length > 0) {
    em = readjustConnectionPoint(em, edge.waypoints.at(-1)!.point, edge.end.node.bounds);
  }

  const path = new PathListBuilder();
  path.moveTo(sm);

  let availableDirections = Direction.all();
  let preferredDirections: ReadonlyArray<Direction> = preferredStartDirection
    ? [preferredStartDirection]
    : [];
  let prevPosition: Waypoint = { point: sm };
  edge.waypoints.forEach(mp => {
    const result = addSegment(prevPosition, mp, availableDirections, preferredDirections);

    availableDirections = result[0].availableDirections;
    preferredDirections = result[0].preferredDirection;

    const p = result[0].path;
    assert.true(p.pathCount === 1);
    p.active.instructions.forEach(i => path.appendInstruction(i));

    prevPosition = mp;
  });

  const endResult = addSegment(
    prevPosition,
    { point: em },
    availableDirections,
    preferredDirections
  );

  const best =
    endResult.find(r => r.endDirection === preferredEndDirection)?.path ??
    endResult.toSorted((a, b) => {
      const c1 = a.path.getPaths().all()[0]?.numberOfSegments ?? 100;
      const c2 = b.path.getPaths().all()[0]?.numberOfSegments ?? 100;
      return c1 - c2;
    })[0].path;

  assert.true(best.pathCount === 1);
  best.active.instructions.forEach(i => path.appendInstruction(i));

  return path.getPaths().singular();
};

const buildBezierEdgePath = (edge: DiagramEdge) => {
  const path = new PathListBuilder();

  path.moveTo(edge.start.position);
  if (edge.waypoints.length === 0) {
    path.lineTo(edge.end.position);
  } else {
    const controlPoints: ControlPoints[] = [];

    // Ensure all control points exists, as they may not in case the edge type has been changed
    for (let i = 0; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i];
      if (wp.controlPoints) {
        controlPoints.push(wp.controlPoints);
      } else {
        controlPoints.push(edge.inferControlPoints(i));
      }
    }

    const fp = edge.waypoints[0];
    path.quadTo(fp.point, Point.add(controlPoints[0].cp1, fp.point));
    for (let i = 1; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i];
      const pwp = edge.waypoints[i - 1];
      path.cubicTo(
        wp.point,
        Point.add(controlPoints[i - 1].cp2, pwp.point),
        Point.add(controlPoints[i].cp1, wp.point)
      );
    }

    const last = edge.waypoints.at(-1)!;
    path.quadTo(edge.end.position, Point.add(controlPoints.at(-1)!.cp2, last.point));
  }

  return path.getPaths().singular();
};

const buildStraightEdgePath = (edge: DiagramEdge) => {
  const path = new PathListBuilder();

  path.moveTo(edge.start.position);
  edge.waypoints.forEach(wp => {
    path.lineTo(wp.point);
  });
  path.lineTo(edge.end.position);

  return path.getPaths().singular();
};

export const buildEdgePath = (
  edge: DiagramEdge,
  rounding: number,
  preferedStartDirection?: Direction,
  preferedEndDirection?: Direction
): Path => {
  switch (edge.renderProps.type) {
    case 'orthogonal': {
      const r = buildOrthogonalEdgePath(edge, preferedStartDirection, preferedEndDirection);
      return rounding > 0 ? Path.from(r, applyRounding(rounding)) : r;
    }
    case 'curved': {
      const r = buildOrthogonalEdgePath(edge, preferedStartDirection, preferedEndDirection).clean();
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
    const segment = segments[i];
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
