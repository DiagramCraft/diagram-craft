import { PathBuilder } from '../geometry/pathBuilder.ts';
import { unique } from '../utils/array.ts';
import { Direction } from '../geometry/direction.ts';
import { Point } from '../geometry/point.ts';
import { Path } from '../geometry/path.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { ControlPoints, Waypoint } from './types.ts';
import { Line } from '../geometry/line.ts';
import { CubicSegment, LineSegment, PathSegment } from '../geometry/pathSegment.ts';
import { BezierUtils } from '../geometry/bezier.ts';
import { Vector } from '../geometry/vector.ts';

type Result = {
  startDirection: Direction;
  endDirection: Direction;
  path: PathBuilder;
  availableDirections: ReadonlyArray<Direction>;
  preferedDirection: ReadonlyArray<Direction>;
};

const addSegment = (
  prevWP: Waypoint,
  thisWP: Waypoint,
  availableDirections: ReadonlyArray<Direction>,
  preferedDirection: ReadonlyArray<Direction>
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
    ...preferedDirection.filter(isAvailable),
    ...availableDirections.filter(isAvailable),
    ...availableDirections
  ]);

  return dirInOrder.map(direction => {
    const p = new PathBuilder();

    const entry: Result = {
      startDirection: direction,
      endDirection: direction,
      path: p,
      availableDirections: [],
      preferedDirection: []
    };

    if (direction === 's') {
      p.lineTo({ x: px, y });
      p.lineTo({ x, y });
      entry.endDirection = x < px ? 'w' : 'e';
    } else if (direction === 'n') {
      p.lineTo({ x: px, y });
      p.lineTo({ x, y });
      entry.endDirection = x < px ? 'w' : 'e';
    } else if (direction === 'e') {
      p.lineTo({ x, y: py });
      p.lineTo({ x, y });
      entry.endDirection = y < py ? 'n' : 's';
    } else if (direction === 'w') {
      p.lineTo({ x, y: py });
      p.lineTo({ x, y });
      entry.endDirection = y < py ? 'n' : 's';
    }

    entry.availableDirections = Direction.all().filter(
      d => d !== Direction.opposite(entry.endDirection)
    );
    entry.preferedDirection = [entry.endDirection];

    return entry;
  });
};

const buildOrthogonalEdgePath = (
  edge: DiagramEdge,
  preferedStartDirection: Direction | undefined,
  preferedEndDirection: Direction | undefined
) => {
  const sm = edge.start.position;
  const em = edge.end.position;

  const path = new PathBuilder();
  path.moveTo(sm);

  let availableDirections = Direction.all();
  let preferedDirections: ReadonlyArray<Direction> = preferedStartDirection
    ? [preferedStartDirection]
    : [];
  let prevPosition: Waypoint = { point: sm };
  edge.waypoints.forEach(mp => {
    const result = addSegment(prevPosition, mp, availableDirections, preferedDirections);

    availableDirections = result[0].availableDirections;
    preferedDirections = result[0].preferedDirection;

    path.append(result[0].path);

    prevPosition = mp;
  });

  const endResult = addSegment(
    prevPosition,
    { point: em },
    availableDirections,
    preferedDirections
  );
  path.append(
    endResult.find(r => r.endDirection === preferedEndDirection)?.path ?? endResult[0].path
  );

  return path;
};

const buildCurvedEdgePath = (edge: DiagramEdge) => {
  const em = edge.end.position;

  const path = new PathBuilder();

  path.moveTo(edge.start.position);
  if (edge.waypoints.length === 0) {
    path.lineTo(em);
  } else if (edge.waypoints.length === 1) {
    path.quadTo(
      em,
      BezierUtils.qubicFromThreePoints(edge.start.position, em, edge.waypoints[0].point)
    );
  } else {
    path.quadTo(
      edge.waypoints[1].point,
      BezierUtils.qubicFromThreePoints(
        edge.start.position,
        edge.waypoints[0].point,
        edge.waypoints[1].point
      )
    );
    for (let i = 2; i < edge.waypoints.length; i++) {
      path.curveTo(edge.waypoints[i].point);
    }
    path.curveTo(em);
  }

  return path;
};

const buildBezierEdgePath = (edge: DiagramEdge) => {
  const path = new PathBuilder();

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
        const before = i === 0 ? edge.start.position : edge.waypoints[i - 1].point;
        const after =
          i === edge.waypoints.length - 1 ? edge.end.position : edge.waypoints[i + 1].point;

        controlPoints.push({
          cp1: Vector.scale(Vector.from(after, before), 0.2),
          cp2: Vector.scale(Vector.from(before, after), 0.2)
        });
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

  return path;
};

const buildStraightEdgePath = (edge: DiagramEdge) => {
  const path = new PathBuilder();

  path.moveTo(edge.start.position);
  edge.waypoints.forEach(wp => {
    path.lineTo(wp.point);
  });
  path.lineTo(edge.end.position);
  return path;
};

export const buildEdgePath = (
  edge: DiagramEdge,
  rounding: number,
  preferedStartDirection?: Direction,
  preferedEndDirection?: Direction
): Path => {
  switch (edge.props.type) {
    case 'orthogonal': {
      const r = buildOrthogonalEdgePath(
        edge,
        preferedStartDirection,
        preferedEndDirection
      ).getPath();
      if (rounding > 0) r.processSegments(applyRounding(rounding));
      return r;
    }
    case 'curved':
      return buildCurvedEdgePath(edge).getPath();
    case 'bezier':
      return buildBezierEdgePath(edge).getPath();

    default: {
      const r = buildStraightEdgePath(edge).getPath();
      if (rounding > 0) r.processSegments(applyRounding(rounding));
      return r;
    }
  }
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
