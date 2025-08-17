import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { type Edge, findShortestPathAStar, SimpleGraph } from '@diagram-craft/utils/graph';
import { Direction } from '@diagram-craft/geometry/direction';
import type { DiagramEdge } from './diagramEdge';
import { ConnectedEndpoint } from './endpoint';
import { unique } from '@diagram-craft/utils/array';
import { round } from '@diagram-craft/utils/math';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Waypoint } from './types';
import { assert } from '@diagram-craft/utils/assert';

type Result = {
  startDirection: Direction;
  endDirection: Direction;
  path: PathListBuilder;
  availableDirections: ReadonlyArray<Direction>;
  preferredDirection: ReadonlyArray<Direction>;
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

class OrthogonalGraph extends SimpleGraph<Point, [Direction, string]> {
  private reset: (() => void) | undefined = undefined;

  private edgesCrossing(bounds: Box) {
    const edges: Edge<[Direction, string]>[] = [];

    for (const edge of this.edges()) {
      const start = this.getVertex(edge.from);
      const end = this.getVertex(edge.to);
      if (!start || !end || !start.data || !end.data) continue;

      const b = Box.fromCorners(start.data, end.data);
      if (Box.intersects(bounds, b)) {
        edges.push(edge);
      }
    }

    return edges;
  }

  withStartAndEnd(
    start: {
      id: string;
      directionPenalties: Partial<Record<Direction, number>>;
      bounds?: Box;
    },
    end: {
      id: string;
      directionPenalties: Partial<Record<Direction, number>>;
      bounds?: Box;
    },
    prohibitedBounds?: Box[]
  ) {
    this.reset?.();

    const oldWeights = new Map<string, number>();

    for (const adj of this.adjacencyList().get(start.id)!) {
      oldWeights.set(adj.edge.id, adj.edge.weight);
      adj.edge.weight += start.directionPenalties[adj.edge.data[0]] ?? 0;
    }

    for (const adj of this.adjacencyList().get(end.id)!) {
      const edge = this.getEdge(`${adj.vertexId}-${end.id}`)!;
      oldWeights.set(edge.id, edge.weight);
      edge.weight += end.directionPenalties[Direction.opposite(edge.data[0])] ?? 0;
    }

    const disabledEdges = prohibitedBounds?.flatMap(b => this.edgesCrossing(b));
    disabledEdges?.forEach(e => (e.disabled = true));

    this.reset = () => {
      disabledEdges?.forEach(e => (e.disabled = false));
      oldWeights.forEach((w, e) => {
        const edge = this.getEdge(e);
        if (edge) edge.weight = w;
      });

      this.reset = undefined;
    };

    return this;
  }
}

export type EdgeType =
  | 'midpoint'
  | 'start-end'
  | 'waypoint'
  | 'waypoint-mid'
  | 'bounds'
  | 'outer-bounds';

const isPointInBounds = (p: Point, bounds: Box | undefined) => {
  return bounds && !Point.isEqual(p, Box.center(bounds)) && Box.contains(bounds, p);
};

const constructGraph = (edge: DiagramEdge, start: Point, end: Point) => {
  const startNode = edge.start instanceof ConnectedEndpoint ? edge.start.node : undefined;
  const endNode = edge.end instanceof ConnectedEndpoint ? edge.end.node : undefined;

  const ys = new Map<number, EdgeType>();
  const xs = new Map<number, EdgeType>();

  const addForPoint = (p: Point, type: EdgeType) => {
    ys.set(round(p.y), type);
    xs.set(round(p.x), type);
  };
  const addForBox = (b: Box | undefined, type: EdgeType) => {
    if (!b) return;
    ys.set(round(b.y), type);
    ys.set(round(b.y + b.h), type);
    xs.set(round(b.x), type);
    xs.set(round(b.x + b.w), type);
  };

  // We add grid lines in reverse order of priority

  // Outer bounds
  const bounds: Box[] = [];
  if (startNode) bounds.push(startNode.bounds);
  if (endNode) bounds.push(endNode.bounds);
  edge.waypoints.forEach(wp => bounds.push(Box.fromCorners(wp.point, wp.point)));
  addForBox(Box.grow(Box.boundingBox(bounds), 20), 'outer-bounds');

  // Add for bounds
  addForBox(startNode ? Box.grow(startNode.bounds, 10) : undefined, 'bounds');
  addForBox(endNode ? Box.grow(endNode.bounds, 10) : undefined, 'bounds');

  // Add for midpoints valid waypoints
  for (let i = 0; i < edge.waypoints.length; i++) {
    const wp = edge.waypoints[i];

    if (i === 0) {
      if (startNode) {
        const midpoint = Box.midpoint(startNode.bounds, Box.fromCorners(wp.point, wp.point));
        addForPoint(midpoint, 'waypoint-mid');
      } else {
        addForPoint(Point.midpoint(start, wp.point), 'waypoint-mid');
      }
    }

    if (i === edge.waypoints.length - 1) {
      if (endNode) {
        const midpoint = Box.midpoint(endNode.bounds, Box.fromCorners(wp.point, wp.point));
        addForPoint(midpoint, 'waypoint-mid');
      } else {
        addForPoint(Point.midpoint(end, wp.point), 'waypoint-mid');
      }
    }

    if (i < edge.waypoints.length - 1) {
      const nextWp = edge.waypoints[i + 1];
      addForPoint(Point.midpoint(wp.point, nextWp.point), 'waypoint-mid');
    }
  }

  // Add for midpoint
  const midpoint = Box.midpoint(
    startNode ? startNode.bounds : Box.fromCorners(start, start),
    endNode ? endNode.bounds : Box.fromCorners(end, end)
  );
  addForPoint(midpoint, 'midpoint');

  // Add for valid waypoints
  for (let i = 0; i < edge.waypoints.length; i++) {
    const wp = edge.waypoints[i];
    addForPoint(wp.point, 'waypoint');
  }

  // Add lines for start and end position
  addForPoint(start, 'start-end');
  addForPoint(end, 'start-end');

  // Sort and remove duplicate lines
  const TOO_CLOSE = 10;
  const finalYs = [...ys.keys()]
    .sort((a, b) => a - b)
    .filter(
      (v, i, a) =>
        i === 0 ||
        Math.abs(v - a[i - 1]) > TOO_CLOSE ||
        ys.get(v) === 'start-end' ||
        ys.get(v) === 'waypoint'
    );
  const finalXs = [...xs.keys()]
    .sort((a, b) => a - b)
    .filter(
      (v, i, a) =>
        i === 0 ||
        Math.abs(v - a[i - 1]) > TOO_CLOSE ||
        xs.get(v) === 'start-end' ||
        xs.get(v) === 'waypoint'
    );

  // Calculate intersections
  const grid: Array<Array<Point>> = [];
  for (const h of finalYs) {
    const row: Array<Point> = [];
    grid.push(row);
    for (const v of finalXs) {
      row.push(_p(v, h));
    }
  }

  // Build graph
  const graph = new OrthogonalGraph();

  const addEdge = (r1: number, c1: number, r2: number, c2: number, d: Direction) => {
    if (
      r1 < 0 ||
      r2 < 0 ||
      c1 < 0 ||
      c2 < 0 ||
      r1 >= grid.length ||
      r2 >= grid.length ||
      c1 >= grid[0].length ||
      c2 >= grid[0].length
    ) {
      return;
    }

    const a = Point.toString(grid[r1][c1]);
    const b = Point.toString(grid[r2][c2]);

    const weight = Point.manhattanDistance(grid[r1][c1], grid[r2][c2]);

    const isHorizontal = d === 'e' || d === 'w';
    const type = isHorizontal ? ys.get(grid[r1][c1].y)! : xs.get(grid[r1][c1].x)!;

    graph.addEdge({
      id: `${a}-${b}`,
      from: a,
      to: b,
      data: [d, type],
      weight
    });
    graph.addEdge({
      id: `${b}-${a}`,
      from: b,
      to: a,
      data: [Direction.opposite(d), type],
      weight
    });
  };

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const vertexId = Point.toString(grid[r][c]);
      graph.addVertex({ id: vertexId, data: grid[r][c] });

      addEdge(r, c, r + 1, c, 's');
      addEdge(r, c, r, c + 1, 'e');
    }
  }

  const firstValid = (r: number, c: number, rd: number, cd: number) => {
    let cr = r;
    let cc = c;
    do {
      cr += rd;
      cc += cd;
      if (cr < 0 || cr >= grid.length) return { r: -1, c: -1 };
      if (cc < 0 || cc >= grid[0].length) return { r: -1, c: -1 };
    } while (
      isPointInBounds(grid[cr][cc], startBounds) ||
      isPointInBounds(grid[cr][cc], endBounds)
    );

    return { r: cr, c: cc };
  };

  const startBounds = startNode?.bounds;
  const endBounds = endNode?.bounds;

  const verticesToRemove = new Set<string>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (isPointInBounds(grid[r][c], startBounds) || isPointInBounds(grid[r][c], endBounds)) {
        const vid = Point.toString(grid[r][c]);
        if (verticesToRemove.has(vid)) continue;

        verticesToRemove.add(vid);

        addEdge(firstValid(r, c, 1, 0).r, c, r - 1, c, 'n');
        addEdge(r, firstValid(r, c, 0, 1).c, r, c - 1, 'w');
        addEdge(firstValid(r, c, -1, 0).r, c, r + 1, c, 's');
        addEdge(r, firstValid(r, c, 0, -1).c, r, c + 1, 'e');
      }
    }
  }
  verticesToRemove.forEach(v => graph.removeVertex(v));
  [...graph.edges()]
    .filter(e => verticesToRemove.has(e.from) || verticesToRemove.has(e.to))
    .forEach(e => graph.removeEdge(e.id));

  for (const e of graph.edges()) {
    if (e.data[1] === 'start-end' || e.data[1] === 'waypoint') e.weight *= 0.9;
    if (e.data[1] === 'midpoint' || e.data[1] === 'waypoint-mid') e.weight *= 0.9;
    if (e.data[1] === 'outer-bounds') e.weight *= 1.05;
  }

  return graph;
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
          full.moveTo({ x: 0, y: 0 });
          full.lineTo({ x: px, y });
          full.lineTo({ x, y });

          const half = new PathListBuilder();
          half.moveTo({ x: 0, y: 0 });
          half.lineTo({ x: px, y: py + (y - py) / 2 });
          half.lineTo({ x, y: py + (y - py) / 2 });
          half.lineTo({ x, y });

          return [makeEntry(full, x < px ? 'w' : 'e'), makeEntry(half, y < py ? 'n' : 's')];
        }
        case 'e':
        case 'w': {
          const full = new PathListBuilder();
          full.moveTo({ x: 0, y: 0 });
          full.lineTo({ x, y: py });
          full.lineTo({ x, y });

          const half = new PathListBuilder();
          half.moveTo({ x: 0, y: 0 });
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

const directionPenalty = (): Record<Direction, number> => ({ n: 2000, s: 2000, e: 2000, w: 2000 });

const buildOrthogonalEdgePathVersion2 = (
  edge: DiagramEdge,
  preferredStartDirectionRaw: Direction | undefined,
  preferredEndDirection: Direction | undefined
) => {
  const preferredStartDirection = preferredStartDirectionRaw
    ? Direction.opposite(preferredStartDirectionRaw)
    : undefined;

  const start = edge.start.position;
  const end = edge.end.position;

  const graph = constructGraph(edge, start, end);

  const visitedPoints = new Set<string>();

  const startNode = edge.start instanceof ConnectedEndpoint ? edge.start.node : undefined;
  const endNode = edge.end instanceof ConnectedEndpoint ? edge.end.node : undefined;

  let startId = Point.toString(start);
  const endId = Point.toString(end);

  const path = new PathListBuilder();
  path.moveTo(start);

  let lastEdge: Edge<[Direction, string]> | undefined = undefined;
  for (let i = 0; i < edge.waypoints.length; i++) {
    const wp = edge.waypoints[i];
    const endOfSegmentId = Point.toString(wp.point);

    const startPenalty = directionPenalty();
    if (lastEdge) {
      // Ensure we will not go back from where we came from
      startPenalty[lastEdge.data![0]] = 20000;
      startPenalty[Direction.opposite(lastEdge.data![0])] = 0;
    } else {
      if (preferredStartDirection) startPenalty[preferredStartDirection] = 0;
    }

    const prohibitedBounds: Box[] = [];
    if (i > 0 && startNode) prohibitedBounds.push(startNode.bounds);
    if (endNode) prohibitedBounds.push(endNode.bounds);

    const shortestPathToWaypoint = findShortestPathAStar(
      graph.withStartAndEnd(
        {
          id: startId,
          bounds: i == 0 ? startNode?.bounds : undefined,
          directionPenalties: startPenalty
        },
        {
          id: endOfSegmentId,
          directionPenalties: {}
        },
        prohibitedBounds
      ),
      startId,
      endOfSegmentId,
      (_, current) => Point.manhattanDistance(current.data ?? wp.point, wp.point) * 0.9,
      (previousEdge, _currentVertex, proposedEdge) => {
        // Avoid path crossing itself
        if (visitedPoints.has(proposedEdge.to)) return 1000000;
        if (previousEdge && previousEdge.data[0] !== proposedEdge.data[0]) return 1.03;
      }
    );
    for (const e of shortestPathToWaypoint!.path) {
      if (e.data! === undefined) continue;
      path.lineTo(e.data!);
    }
    shortestPathToWaypoint?.path.forEach(e => visitedPoints.add(e.id));

    lastEdge = shortestPathToWaypoint?.edges?.at(-1);
    startId = endOfSegmentId;
  }

  const prohibitedBounds: Box[] = [];
  if (startNode && edge.waypoints.length > 0) prohibitedBounds.push(startNode.bounds);

  const startPenalty = directionPenalty();
  if (lastEdge) {
    startPenalty[lastEdge.data![0]] = 20000;
    startPenalty[Direction.opposite(lastEdge.data![0])] = 0;
  } else {
    if (preferredStartDirection) startPenalty[preferredStartDirection] = 0;
  }

  const endPenalty = directionPenalty();
  if (preferredEndDirection) endPenalty[preferredEndDirection] = 0;

  const shortestPath = findShortestPathAStar(
    graph.withStartAndEnd(
      {
        id: startId,
        directionPenalties: startPenalty,
        bounds: edge.waypoints.length > 0 ? undefined : startNode?.bounds
      },
      {
        id: endId,
        directionPenalties: endPenalty,
        bounds: endNode?.bounds
      },
      prohibitedBounds
    ),
    startId,
    endId,
    (_, current) => Point.manhattanDistance(current.data ?? end, end) * 0.9,
    (previousEdge, _currentVertex, proposedEdge) => {
      // Avoid path crossing itself
      if (visitedPoints.has(proposedEdge.to)) return 1000000;
      if (previousEdge && previousEdge.data[0] !== proposedEdge.data[0]) return 1.03;
    }
  );

  if (shortestPath) {
    for (const e of shortestPath!.path) {
      if (e.data! === undefined) continue;
      path.lineTo(e.data!);
    }
  }

  const paths = path.getPaths();
  if (paths.all().length === 0) return undefined;
  return paths.singular().simplify();
};

const buildOrthogonalEdgePathVersion1 = (
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

export const buildOrthogonalEdgePath = (
  edge: DiagramEdge,
  preferredStartDirection: Direction | undefined,
  preferredEndDirection: Direction | undefined
) => {
  const startNode = edge.start instanceof ConnectedEndpoint ? edge.start.node : undefined;
  const endNode = edge.end instanceof ConnectedEndpoint ? edge.end.node : undefined;
  if (
    (startNode && startNode.renderProps.routing.constraint !== 'none') ||
    (endNode && endNode.renderProps.routing.constraint !== 'none')
  ) {
    return (
      buildOrthogonalEdgePathVersion2(
        edge,
        startNode && startNode.renderProps.routing.constraint !== 'none'
          ? startNode.renderProps.routing.constraint
          : preferredStartDirection,
        endNode && endNode.renderProps.routing.constraint !== 'none'
          ? endNode.renderProps.routing.constraint
          : preferredEndDirection
      ) ?? buildOrthogonalEdgePathVersion1(edge, preferredStartDirection, preferredEndDirection)
    );
  } else {
    return buildOrthogonalEdgePathVersion1(edge, preferredStartDirection, preferredEndDirection);
  }
};

export const _test = {
  constructGraph,
  buildOrthogonalEdgePathVersion1,
  buildOrthogonalEdgePathVersion2
};
