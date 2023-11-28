import { Path, PathBuilder } from '../geometry/pathBuilder.ts';
import { DiagramEdge, Waypoint } from '../model-viewer/diagram.ts';
import { unique } from '../utils/array.ts';
import { Direction } from '../geometry/direction.ts';
import { Point } from '../geometry/point.ts';

type Result = {
  startDirection: Direction;
  endDirection: Direction;
  path: PathBuilder;
  availableDirections: Direction[];
  preferedDirection: Direction[];
};

const addSegment = (
  prevWP: Waypoint,
  thisWP: Waypoint,
  availableDirections: Direction[],
  preferedDirection: Direction[]
): Result[] => {
  const { x: px, y: py } = prevWP.point;
  const { x: x, y: y } = thisWP.point;

  const isAvailable = (d: Direction) => {
    if (d === 's' && y > py) return true;
    if (d === 'n' && y < py) return true;
    if (d === 'e' && x > px) return true;
    return d === 'w' && x < px;
  };
  const dirInOrder = unique(
    [
      ...preferedDirection.filter(isAvailable),
      ...availableDirections.filter(isAvailable),
      ...availableDirections
    ],
    a => a
  );

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
      p.lineTo(px, y);
      p.lineTo(x, y);
      entry.endDirection = x < px ? 'w' : 'e';
    } else if (direction === 'n') {
      p.lineTo(px, y);
      p.lineTo(x, y);
      entry.endDirection = x < px ? 'w' : 'e';
    } else if (direction === 'e') {
      p.lineTo(x, py);
      p.lineTo(x, y);
      entry.endDirection = y < py ? 'n' : 's';
    } else if (direction === 'w') {
      p.lineTo(x, py);
      p.lineTo(x, y);
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
  const sm = edge.startPosition;
  const em = edge.endPosition;

  const path = new PathBuilder();
  path.moveToPoint(sm);

  let availableDirections: Direction[] = Direction.all();
  let preferedDirections: Direction[] = preferedStartDirection ? [preferedStartDirection] : [];
  let prevPosition: Waypoint = { point: sm };
  edge.waypoints?.forEach(mp => {
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
  const em = edge.endPosition;

  const path = new PathBuilder();

  path.moveToPoint(edge.startPosition);
  if (!edge.waypoints || edge.waypoints.length === 0) {
    path.lineToPoint(em);
  } else if (edge.waypoints.length === 1) {
    path.quadToPoint(em, edge.waypoints[0].point);
  } else {
    path.quadToPoint(edge.waypoints[1].point, edge.waypoints[0].point);
    for (let i = 2; i < edge.waypoints.length; i++) {
      path.curveToPoint(edge.waypoints[i].point);
    }
    path.curveToPoint(em);
  }

  return path;
};

const buildBezierEdgePath = (edge: DiagramEdge) => {
  const path = new PathBuilder();

  path.moveToPoint(edge.startPosition);
  if (!edge.waypoints || edge.waypoints.length === 0) {
    path.lineToPoint(edge.endPosition);
  } else {
    // TODO: We should improve the way this works when adding new waypoints
    //       e.g. using the tangent line
    // Ensure all control points exists
    for (let i = 0; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i];
      if (!wp.controlPoints) {
        wp.controlPoints = [
          { x: 20, y: 20 },
          { x: -20, y: -20 }
        ];
      }
    }

    const fp = edge.waypoints[0];
    path.quadToPoint(fp.point, Point.add(fp.controlPoints![0], fp.point));
    for (let i = 1; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i];
      const pwp = edge.waypoints[i - 1];
      path.cubicToPoint(
        wp.point,
        Point.add(pwp.controlPoints![1], pwp.point),
        Point.add(wp.controlPoints![0], wp.point)
      );
    }

    const last = edge.waypoints.at(-1)!;
    path.quadToPoint(edge.endPosition, Point.add(last.controlPoints![1], last.point));
  }

  return path;
};

const buildStraightEdgePath = (edge: DiagramEdge) => {
  const path = new PathBuilder();

  path.moveToPoint(edge.startPosition);
  edge.waypoints?.forEach(wp => {
    path.lineToPoint(wp.point);
  });
  path.lineToPoint(edge.endPosition);
  return path;
};

export const buildEdgePath = (
  edge: DiagramEdge,
  preferedStartDirection?: Direction,
  preferedEndDirection?: Direction
): Path => {
  switch (edge.props.type) {
    case 'orthogonal':
      return buildOrthogonalEdgePath(edge, preferedStartDirection, preferedEndDirection).getPath();
    case 'curved':
      return buildCurvedEdgePath(edge).getPath();
    case 'bezier':
      return buildBezierEdgePath(edge).getPath();

    default:
      return buildStraightEdgePath(edge).getPath();
  }
};
