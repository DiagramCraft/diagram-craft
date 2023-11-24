import { Path } from '../geometry/path.ts';
import { DiagramEdge, Waypoint } from '../model-viewer/diagram.ts';
import { unique } from '../utils/array.ts';
import { Direction } from '../geometry/direction.ts';

type Result = {
  startDirection: Direction;
  endDirection: Direction;
  path: Path;
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
    if (d === 'w' && x < px) return true;
    return false;
  };
  const bestDirections = unique(
    [
      ...preferedDirection.filter(isAvailable),
      ...availableDirections.filter(isAvailable),
      ...availableDirections
    ],
    a => a
  );

  return bestDirections.map(direction => {
    const p = new Path('SCREEN_UNIT');

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

export const buildEdgePath = (
  edge: DiagramEdge,
  preferedStartDirection?: Direction,
  preferedEndDirection?: Direction
): Path => {
  const sm = edge.startPosition;
  const em = edge.endPosition;

  const path = new Path('SCREEN_UNIT');
  path.moveTo(sm.x, sm.y);

  let availableDirections: Direction[] = ['s', 'n', 'e', 'w'];
  let preferedDirections: Direction[] = preferedStartDirection ? [preferedStartDirection] : [];
  let prevPosition: Waypoint = { point: sm, type: 'horizontal' };
  if (edge.waypoints) {
    edge.waypoints.forEach(mp => {
      const result = addSegment(prevPosition, mp, availableDirections, preferedDirections);

      availableDirections = result[0].availableDirections;
      preferedDirections = result[0].preferedDirection;

      path.append(result[0].path);

      prevPosition = mp;
    });
  }

  const endResult = addSegment(
    prevPosition,
    { point: em, type: 'horizontal' },
    availableDirections,
    preferedDirections
  );
  path.append(
    endResult.find(r => r.endDirection === preferedEndDirection)?.path ?? endResult[0].path
  );

  return path;
};
