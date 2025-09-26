import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import {
  type Edge,
  findShortestPathAStar,
  type HeuristicFunction,
  SimpleGraph,
  type Vertex
} from '@diagram-craft/utils/graph';
import { Direction } from '@diagram-craft/geometry/direction';
import type { DiagramEdge } from './diagramEdge';
import { ConnectedEndpoint, type Endpoint } from './endpoint';
import { unique } from '@diagram-craft/utils/array';
import { roundHighPrecision } from '@diagram-craft/utils/math';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { assert } from '@diagram-craft/utils/assert';
import type { DiagramNode } from './diagramNode';

const Weights = {
  direction: {
    s: (v: number) => v,
    n: (v: number) => v + 5,
    e: (v: number) => v + 10,
    w: (v: number) => v + 15
  },
  baseDirectionPenalty: 2000,
  continuePath: {
    continue: () => 0
  },
  turnPenalty: () => 1.1,
  selfCrossingPenalty: () => 1000000,
  edgeType: {
    primary: (v: number) => v * 0.9,
    secondary: (v: number) => v * 0.9,
    tertiary: (v: number) => v * 1.01
  }
};

const makeHeuristic =
  (end: Point): HeuristicFunction<Point, [Direction, string]> =>
  (_from: Vertex<Point>, to: Vertex<Point>) =>
    Point.manhattanDistance(to.data ?? end, end) * 0.8;

interface SegmentProvider {
  addSegment(
    start: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    },
    end: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    },
    visitedPoints: Set<string>
  ): SegmentResult[];
}

type SegmentResult = {
  points: Point[];
  startDirection: Direction;
  endDirection: Direction;
  availableDirections: ReadonlyArray<Direction>;
  preferredDirection: ReadonlyArray<Direction>;
};

/*
 * In case an edge is connected to the central point of a node, orthogonal routed edges
 * connects to the closest point on the bounding box of the node instead of the center
 *
 * This function adjusts the connection point to the closest point on the bounding box
 */
const readjustConnection = (p: Point, wp: Point, startBounds: Box) => {
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
    },
    end: {
      id: string;
      directionPenalties: Partial<Record<Direction, number>>;
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

    const disabledEdges = prohibitedBounds
      ?.flatMap(b => this.edgesCrossing(b))
      .filter(e => e.data[1] !== 'start-end' && e.data[1] !== 'waypoint');
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

class FastSegmentProvider implements SegmentProvider {
  constructor() {}

  addSegment(
    start: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    },
    end: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    }
  ): SegmentResult[] {
    const { x: px, y: py } = start.point;
    const { x: x, y: y } = end.point;

    const isAvailable = (d: Direction) => {
      if (d === 's' && y > py) return true;
      if (d === 'n' && y < py) return true;
      if (d === 'e' && x > px) return true;
      return d === 'w' && x < px;
    };
    const dirInOrder = unique([
      ...start.preferredDirections.filter(isAvailable),
      ...start.availableDirections.filter(isAvailable),
      ...start.availableDirections
    ]);

    return dirInOrder
      .flatMap(direction => {
        const makeEntry = (points: Point[], endDirection: Direction): SegmentResult => ({
          startDirection: direction,
          endDirection,
          points,
          availableDirections: [],
          preferredDirection: []
        });

        switch (direction) {
          case 'n':
          case 's': {
            return [
              makeEntry(
                [
                  { x: px, y },
                  { x, y }
                ],
                x < px ? 'w' : 'e'
              ),
              makeEntry(
                [
                  { x: px, y: py + (y - py) / 2 },
                  { x, y: py + (y - py) / 2 },
                  { x, y }
                ],
                y < py ? 'n' : 's'
              )
            ];
          }
          case 'e':
          case 'w': {
            return [
              makeEntry(
                [
                  { x, y: py },
                  { x, y }
                ],
                y < py ? 'n' : 's'
              ),
              makeEntry(
                [
                  { x: px + (x - px) / 2, y: py },
                  { x: px + (x - px) / 2, y },
                  { x, y }
                ],
                x < px ? 'w' : 'e'
              )
            ];
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
  }
}

class PathfindingSegmentProvider implements SegmentProvider {
  private initialized = false;
  private graph: OrthogonalGraph | undefined = undefined;
  private startNode: DiagramNode | undefined;
  private endNode: DiagramNode | undefined;

  constructor(private edge: DiagramEdge) {
    this.startNode = edge.start instanceof ConnectedEndpoint ? edge.start.node : undefined;
    this.endNode = edge.end instanceof ConnectedEndpoint ? edge.end.node : undefined;
  }

  private initialize() {
    const start = this.edge.start.position;
    const end = this.edge.end.position;
    this.graph = this.constructGraph(start, end);
  }

  constructGraph(start: Point, end: Point) {
    const ys = new Map<number, EdgeType>();
    const xs = new Map<number, EdgeType>();

    const addForPoint = (p: Point, type: EdgeType) => {
      ys.set(roundHighPrecision(p.y), type);
      xs.set(roundHighPrecision(p.x), type);
    };
    const addForBox = (b: Box | undefined, type: EdgeType) => {
      if (!b) return;
      ys.set(roundHighPrecision(b.y), type);
      ys.set(roundHighPrecision(b.y + b.h), type);
      xs.set(roundHighPrecision(b.x), type);
      xs.set(roundHighPrecision(b.x + b.w), type);
    };

    const mustKeepPoints = new Set<string>(
      [...this.edge.waypoints].map(w => Point.toString(w.point))
    );
    mustKeepPoints.add(Point.toString(start));
    mustKeepPoints.add(Point.toString(end));

    // We add grid lines in reverse order of priority

    // Outer bounds
    const bounds: Box[] = [];
    if (this.startNode) bounds.push(this.startNode.bounds);
    if (this.endNode) bounds.push(this.endNode.bounds);
    this.edge.waypoints.forEach(wp => bounds.push(Box.fromCorners(wp.point, wp.point)));
    addForBox(Box.grow(Box.boundingBox(bounds), 20), 'outer-bounds');

    // Add for bounds
    addForBox(this.startNode ? Box.grow(this.startNode.bounds, 10) : undefined, 'bounds');
    addForBox(this.endNode ? Box.grow(this.endNode.bounds, 10) : undefined, 'bounds');

    // Add for midpoints valid waypoints
    for (let i = 0; i < this.edge.waypoints.length; i++) {
      const wp = this.edge.waypoints[i]!;

      if (i === 0) {
        if (this.startNode) {
          const midpoint = Box.midpoint(this.startNode.bounds, Box.fromCorners(wp.point, wp.point));
          addForPoint(midpoint, 'waypoint-mid');
        } else {
          addForPoint(Point.midpoint(start, wp.point), 'waypoint-mid');
        }
      }

      if (i === this.edge.waypoints.length - 1) {
        if (this.endNode) {
          const midpoint = Box.midpoint(this.endNode.bounds, Box.fromCorners(wp.point, wp.point));
          addForPoint(midpoint, 'waypoint-mid');
        } else {
          addForPoint(Point.midpoint(end, wp.point), 'waypoint-mid');
        }
      }

      if (i < this.edge.waypoints.length - 1) {
        const nextWp = this.edge.waypoints[i + 1]!;
        addForPoint(Point.midpoint(wp.point, nextWp.point), 'waypoint-mid');
      }
    }

    // Add for midpoint
    const midpoint = Box.midpoint(
      this.startNode ? this.startNode.bounds : Box.fromCorners(start, start),
      this.endNode ? this.endNode.bounds : Box.fromCorners(end, end)
    );
    addForPoint(midpoint, 'midpoint');

    // Add for valid waypoints
    for (let i = 0; i < this.edge.waypoints.length; i++) {
      const wp = this.edge.waypoints[i]!;
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
          Math.abs(v - a[i - 1]!) > TOO_CLOSE ||
          ys.get(v) === 'start-end' ||
          ys.get(v) === 'waypoint'
      );
    const finalXs = [...xs.keys()]
      .sort((a, b) => a - b)
      .filter(
        (v, i, a) =>
          i === 0 ||
          Math.abs(v - a[i - 1]!) > TOO_CLOSE ||
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
        c1 >= grid[0]!.length ||
        c2 >= grid[0]!.length
      ) {
        return;
      }

      const a = Point.toString(grid[r1]![c1]!);
      const b = Point.toString(grid[r2]![c2]!);

      const weight = Point.manhattanDistance(grid[r1]![c1]!, grid[r2]![c2]!)!;

      const isHorizontal = d === 'e' || d === 'w';
      const type = isHorizontal ? ys.get(grid[r1]![c1]!.y)! : xs.get(grid[r1]![c1]!.x)!;

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
      for (let c = 0; c < grid[r]!.length; c++) {
        const vertexId = Point.toString(grid[r]![c]!);
        graph.addVertex({ id: vertexId, data: grid[r]![c]! });

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
        if (cc < 0 || cc >= grid[0]!.length) return { r: -1, c: -1 };
      } while (
        (Box.contains(startBounds, grid[cr]![cc]!) || Box.contains(endBounds, grid[cr]![cc]!)) &&
        !mustKeepPoints.has(Point.toString(grid[cr]![cc]!))
      );

      return { r: cr, c: cc };
    };

    const startBounds = this.startNode?.bounds;
    const endBounds = this.endNode?.bounds;

    const verticesToRemove = new Set<string>();
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r]!.length; c++) {
        if (
          (Box.contains(startBounds, grid[r]![c]!) || Box.contains(endBounds, grid[r]![c]!)) &&
          !mustKeepPoints.has(Point.toString(grid[r]![c]!))
        ) {
          const vid = Point.toString(grid[r]![c]!);
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
      if (e.data[1] === 'start-end' || e.data[1] === 'waypoint') {
        e.weight = Weights.edgeType.primary(e.weight);
      } else if (e.data[1] === 'midpoint' || e.data[1] === 'waypoint-mid') {
        e.weight = Weights.edgeType.secondary(e.weight);
      } else if (e.data[1] === 'bounds' || e.data[1] === 'outer-bounds') {
        e.weight = Weights.edgeType.tertiary(e.weight);
      }
    }

    return graph;
  }

  addSegment(
    start: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    },
    end: {
      point: Point;
      availableDirections: ReadonlyArray<Direction>;
      preferredDirections: ReadonlyArray<Direction>;
    },
    visitedPoints: Set<string>
  ): SegmentResult[] {
    if (!this.initialized) this.initialize();
    assert.present(this.graph);

    const startId = Point.toString(start.point);
    const endId = Point.toString(end.point);

    const startPenalty = directionPenalty();
    start.availableDirections.forEach(d => (startPenalty[d] = 1000));
    start.preferredDirections.forEach(d => (startPenalty[d] = 0));

    startPenalty['s'] = Weights.direction.s(startPenalty['s']);
    startPenalty['n'] = Weights.direction.n(startPenalty['n']);
    startPenalty['w'] = Weights.direction.w(startPenalty['w']);
    startPenalty['e'] = Weights.direction.e(startPenalty['e']);

    const endPenalty = directionPenalty();
    end.availableDirections.forEach(d => (endPenalty[d] = 1000));
    end.preferredDirections.forEach(d => (endPenalty[d] = 0));

    endPenalty['s'] = Weights.direction.s(endPenalty['s']);
    endPenalty['n'] = Weights.direction.n(endPenalty['n']);
    endPenalty['w'] = Weights.direction.w(endPenalty['w']);
    endPenalty['e'] = Weights.direction.e(endPenalty['e']);

    const prohibitedBounds: Box[] = [];

    const startBounds = this.startNode?.bounds;
    if (startBounds) {
      prohibitedBounds.push(startBounds);
    }

    const endBounds = this.endNode?.bounds;
    if (endBounds) {
      prohibitedBounds.push(endBounds);
    }

    const shortestPathToWaypoint = findShortestPathAStar(
      this.graph.withStartAndEnd(
        {
          id: startId,
          directionPenalties: startPenalty
        },
        {
          id: endId,
          directionPenalties: endPenalty
        },
        prohibitedBounds
      ),
      startId,
      endId,
      makeHeuristic(end.point),
      (previousEdge, _currentVertex, proposedEdge) => {
        // Avoid path crossing itself
        if (visitedPoints.has(proposedEdge.to)) {
          return Weights.selfCrossingPenalty();
        }
        if (previousEdge && previousEdge.data[0] !== proposedEdge.data[0]) {
          if (proposedEdge.data[1] === 'start-end' || proposedEdge.data[1] === 'waypoint')
            return 0.9;
          if (proposedEdge.data[1] === 'midpoint') return 1;
          return Weights.turnPenalty();
        }
      }
    );

    const points: Point[] = [];
    for (const e of shortestPathToWaypoint!.path) {
      if (e.data! === undefined) continue;
      points.push(e.data!);
    }

    const firstEdge = shortestPathToWaypoint!.edges!.at(0)!;
    const lastEdge = shortestPathToWaypoint!.edges!.at(-1)!;
    return [
      {
        points,
        availableDirections: Direction.all().filter(
          d => d !== Direction.opposite(lastEdge.data[0])
        ),
        preferredDirection: [lastEdge.data[0]],
        startDirection: firstEdge.data[0],
        endDirection: lastEdge.data[0]
      }
    ];
  }
}

const directionPenalty = (): Record<Direction, number> => ({
  n: Weights.baseDirectionPenalty,
  s: Weights.baseDirectionPenalty,
  e: Weights.baseDirectionPenalty,
  w: Weights.baseDirectionPenalty
});

function whenConnected(e: Endpoint | undefined): ConnectedEndpoint | undefined {
  if (e instanceof ConnectedEndpoint) return e;
  return undefined;
}

export const buildOrthogonalEdgePath = (
  edge: DiagramEdge,
  preferredStartDirectionP: Direction | undefined,
  preferredEndDirectionP: Direction | undefined,
  isStartForcedP?: boolean,
  isEndForcedP?: boolean
) => {
  const startNode = whenConnected(edge.start)?.node;
  const endNode = whenConnected(edge.end)?.node;

  const startRC = startNode?.renderProps.routing.constraint;
  const endRC = endNode?.renderProps.routing.constraint;

  const hasStartRC = startRC !== undefined && startRC !== 'none';
  const hasEndRC = endRC !== undefined && endRC !== 'none';

  const preferredStartDirection = hasStartRC ? startRC : preferredStartDirectionP;
  const preferredEndDirection = hasEndRC ? endRC : preferredEndDirectionP;

  const isStartForced = (isStartForcedP || hasStartRC) ?? false;
  const isEndForced = (isEndForcedP || hasEndRC) ?? false;

  let startPoint = edge.start.position;
  let endPoint = edge.end.position;

  if (!isStartForced && whenConnected(edge.start)?.isMidpoint() && edge.waypoints.length > 0) {
    startPoint = readjustConnection(startPoint, edge.waypoints[0]!.point, startNode!.bounds);
  }

  if (!isEndForced && whenConnected(edge.end)?.isMidpoint() && edge.waypoints.length > 0) {
    endPoint = readjustConnection(endPoint, edge.waypoints.at(-1)!.point, endNode!.bounds);
  }

  const path = new PathListBuilder();
  path.moveTo(startPoint);

  const visitedPoints = new Set<string>();

  const fastSegmentProvider = new FastSegmentProvider();
  const pathFindingSegmentProvider = new PathfindingSegmentProvider(edge);

  const getProvider = (segIndex: number, segCount: number): SegmentProvider => {
    if (isStartForced && segIndex === 0) return pathFindingSegmentProvider;
    if (isEndForced && segIndex === segCount - 1) return pathFindingSegmentProvider;
    return fastSegmentProvider;
  };

  let availableDirections = Direction.all();
  let preferredDirections: ReadonlyArray<Direction> = preferredStartDirection
    ? [preferredStartDirection]
    : [];
  let prevPosition = startPoint;
  edge.waypoints.forEach((mp, idx) => {
    const result = getProvider(idx, edge.waypoints.length + 1).addSegment(
      {
        point: prevPosition,
        preferredDirections,
        availableDirections
      },
      {
        point: mp.point,
        preferredDirections: [],
        availableDirections: Direction.all()
      },
      visitedPoints
    );

    availableDirections = result[0]!.availableDirections;
    preferredDirections = result[0]!.preferredDirection;

    result[0]!.points.forEach(p => {
      path.lineTo(p);
      visitedPoints.add(Point.toString(p));
    });

    prevPosition = mp.point;
  });

  const endResult = getProvider(edge.waypoints.length, edge.waypoints.length + 1).addSegment(
    {
      point: prevPosition,
      preferredDirections,
      availableDirections
    },
    {
      point: endPoint,
      preferredDirections: preferredEndDirection ? [preferredEndDirection] : [],
      availableDirections: Direction.all()
    },
    visitedPoints
  );

  const best =
    endResult.find(r => r.endDirection === preferredEndDirection) ??
    endResult.toSorted((a, b) => {
      const c1 = a.points.length ?? 100;
      const c2 = b.points.length ?? 100;
      return c1 - c2;
    })[0]!;

  best.points.forEach(p => path.lineTo(p));

  return path.getPaths().singular();
};

export const _test = {
  PathfindingSegmentProvider,
  buildOrthogonalEdgePath
};
