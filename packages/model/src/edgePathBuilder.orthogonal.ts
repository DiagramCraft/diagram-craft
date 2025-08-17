import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import {
  type Edge,
  findShortestPathAStar,
  type Graph,
  SimpleGraph
} from '@diagram-craft/utils/graph';
import { Direction } from '@diagram-craft/geometry/direction';
import { MultiMap } from '@diagram-craft/utils/multimap';
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

class AugmentedGraph extends SimpleGraph<
  [Point | undefined, Point | undefined],
  [Direction, string]
> {
  private reset: (() => void) | undefined = undefined;
  private adjacencyList: MultiMap<string, { vertexId: string; edge: Edge<[Direction, string]> }>;

  constructor(graph: Graph<Point, [Direction, string]>) {
    super();

    // Build adjacency list for efficient lookup
    this.adjacencyList = new MultiMap<
      string,
      { vertexId: string; edge: Edge<[Direction, string]> }
    >();
    for (const edge of graph.edges()) {
      this.adjacencyList.add(edge.from, { vertexId: edge.to, edge });
    }

    // Expand graph
    for (const v of graph.vertices()) {
      for (const adj of this.adjacencyList.get(v.id)!) {
        const from = graph.getVertex(adj.vertexId)!;

        const vertexId = this.vertexKey(from.data, v.data);
        this.addVertex({
          id: vertexId,
          data: [from.data, v.data]
        });

        for (const adj2 of this.adjacencyList.get(v.id)!) {
          const to = graph.getVertex(adj2.vertexId)!;
          if (to === from) continue;

          const toVertexId = this.vertexKey(v.data, to.data);
          const edgeId = this.edgeKey(vertexId, toVertexId);

          this.addEdge({
            id: edgeId,
            from: vertexId,
            to: toVertexId,
            data: [Direction.opposite(adj.edge.data[0]), adj2.edge.data[1]],
            weight:
              Direction.opposite(adj.edge.data[0]) === adj2.edge.data[0]
                ? adj2.edge.weight
                : adj2.edge.weight + 20
          });
        }
      }
    }
  }

  private vertexKey(from: Point, current: Point) {
    return `${Point.toString(from)}-${Point.toString(current)}`;
  }

  private edgeKey(from: string, to: string) {
    return `${from}--${to}`;
  }

  private edgesCrossing(bounds: Box) {
    const edges: Edge<[Direction, string]>[] = [];

    for (const edge of this.edges()) {
      const start = this.getVertex(edge.from);
      const end = this.getVertex(edge.to);
      if (!start || !end || start.data[1] === undefined || end.data[1] === undefined) continue;

      const b = Box.fromCorners(start.data[1], end.data[1]);
      if (Box.intersects(bounds, b)) {
        edges.push(edge);
      }
    }

    return edges;
  }

  private modifyWeights(newWeights: Map<string, number>) {
    const oldWeights = new Map<string, number>();
    for (const [id, weight] of newWeights) {
      const edge = this._edges.get(id)!;
      oldWeights.set(id, weight);
      edge.weight = weight;
    }
    return () => this.modifyWeights(oldWeights);
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

    const addedVertices = new Set<string>();
    const addedEdges = new Set<string>();
    for (const vid of this.adjacencyList.keys()) {
      if (vid === start.id) {
        addedVertices.add(this.addVertex({ id: start.id, data: [undefined, undefined] }).id);
        for (const adj2 of this.adjacencyList.get(vid)!) {
          addedEdges.add(
            this.addEdge({
              id: this.edgeKey(start.id, adj2.vertexId),
              from: start.id,
              to: `${start.id}-${adj2.vertexId}`,
              data: adj2.edge.data,
              weight: adj2.edge.weight + (start.directionPenalties[adj2.edge.data[0]] ?? 0)
            }).id
          );
        }
      } else if (vid === end.id) {
        addedVertices.add(this.addVertex({ id: end.id, data: [undefined, undefined] }).id);
        for (const adj2 of this.adjacencyList.get(vid)!) {
          addedEdges.add(
            this.addEdge({
              id: this.edgeKey(adj2.vertexId, end.id) + '--extra',
              from: `${adj2.vertexId}-${end.id}`,
              to: end.id,
              data: adj2.edge.data,
              weight: adj2.edge.weight + (end.directionPenalties[adj2.edge.data[0]] ?? 0)
            }).id
          );
        }
      }
    }

    const disabledEdges = prohibitedBounds?.flatMap(b => this.edgesCrossing(b));
    disabledEdges?.forEach(e => (e.disabled = true));

    this.reset = () => {
      disabledEdges?.forEach(e => (e.disabled = false));

      addedEdges.forEach(e => this._edges.delete(e));
      addedVertices.forEach(e => this._vertices.delete(e));

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
        const bounds = startNode.bounds;
        const midpoint = Box.midpoint(bounds, Box.fromCorners(wp.point, wp.point));
        addForPoint(midpoint, 'waypoint-mid');
      } else {
        addForPoint(Point.midpoint(start, wp.point), 'waypoint-mid');
      }
    }

    if (i === edge.waypoints.length - 1) {
      if (endNode) {
        const bounds = endNode.bounds;
        const midpoint = Box.midpoint(bounds, Box.fromCorners(wp.point, wp.point));
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
  const finalYs = [...ys.keys()].sort((a, b) => a - b);
  const finalXs = [...xs.keys()].sort((a, b) => a - b);

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
  const graph = new SimpleGraph<Point, [Direction, EdgeType]>();

  const addEdge = (r1: number, c1: number, r2: number, c2: number, d: Direction) => {
    if (r1 < 0 || r1 >= grid.length) return;
    if (r2 < 0 || r2 >= grid.length) return;
    if (c1 < 0 || c1 >= grid[0].length) return;
    if (c2 < 0 || c2 >= grid[0].length) return;

    const a = Point.toString(grid[r1][c1]);
    const b = Point.toString(grid[r2][c2]);

    const weight = Point.distance(graph.getVertex(a)!.data, graph.getVertex(b)!.data);

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
    }
  }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      addEdge(r, c, r - 1, c, 'n');
      addEdge(r, c, r, c - 1, 'w');
      addEdge(r, c, r + 1, c, 's');
      addEdge(r, c, r, c + 1, 'e');
    }
  }

  const isPointInBounds = (p: Point, bounds: Box | undefined) => {
    return bounds && !Point.isEqual(p, Box.center(bounds)) && Box.contains(bounds, p);
  };

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
        verticesToRemove.add(Point.toString(grid[r][c]));

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
    if (e.data[1] === 'start-end' || e.data[1] === 'waypoint') e.weight *= 1;
    if (e.data[1] === 'midpoint' || e.data[1] === 'waypoint-mid') e.weight *= 0.8;
    if (e.data[1] === 'outer-bounds') e.weight *= 1.1;
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

  const baseGraph = constructGraph(edge, start, end);
  const graph = new AugmentedGraph(baseGraph);

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
      (_, current) => Point.squareDistance(current.data[1] ?? wp.point, wp.point),
      (_currentVertex, proposedEdge) => {
        // Avoid path crossing itself
        if (visitedPoints.has(proposedEdge.to.split('-')[1])) return 1000000;
      }
    );
    for (const e of shortestPathToWaypoint!.path) {
      if (e.data![1] === undefined) continue;
      path.lineTo(e.data[1]!);
    }
    shortestPathToWaypoint?.path.forEach(e => visitedPoints.add(e.id.split('-')[1]));

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
    (_, current) => Point.squareDistance(current.data[1] ?? end, end),
    (_currentVertex, proposedEdge) => {
      // Avoid path crossing itself
      if (visitedPoints.has(proposedEdge.to.split('-')[1])) {
        return 1000000;
      }
    }
  );

  for (const e of shortestPath!.path) {
    if (e.data![1] === undefined) continue;
    path.lineTo(e.data![1]);
  }

  return path.getPaths().singular().simplify();
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
    return buildOrthogonalEdgePathVersion2(
      edge,
      startNode && startNode.renderProps.routing.constraint !== 'none'
        ? startNode.renderProps.routing.constraint
        : preferredStartDirection,
      endNode && endNode.renderProps.routing.constraint !== 'none'
        ? endNode.renderProps.routing.constraint
        : preferredEndDirection
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
