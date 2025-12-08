import type { Point } from '@diagram-craft/geometry/point';
import type { Graph } from '../graph';
import { getConnectedComponent } from '../connectivity';
import { layoutLayered } from './layeredLayout';

/**
 * Layout options for series-parallel graph layout algorithm
 */
export type SeriesParallelLayoutOptions = {
  /** Horizontal spacing between nodes (default: 1) */
  horizontalSpacing?: number;
  /** Vertical spacing between nodes (default: 1) */
  verticalSpacing?: number;
  /** Direction of the layout (default: 'down') */
  direction?: 'down' | 'up' | 'left' | 'right';
  /** Whether to fall back to layered layout for non-SP graphs (default: true) */
  fallbackToLayered?: boolean;
};

/**
 * Type of node in the series-parallel decomposition tree
 * - S: Series composition (stack vertically)
 * - P: Parallel composition (arrange horizontally)
 * - Q: Primitive/quantum (single edge)
 */
type SPNodeType = 'S' | 'P' | 'Q';

/**
 * Node in the series-parallel decomposition tree
 */
type SPDecompositionNode<VK> = {
  /** Type of this decomposition node */
  type: SPNodeType;

  /** Unique identifier for this decomposition node */
  id: string;

  /** Source vertex ID for this subgraph */
  source: VK;

  /** Sink vertex ID for this subgraph */
  sink: VK;

  /** Children nodes (for S and P nodes) */
  children?: SPDecompositionNode<VK>[];

  /** Layout dimensions (computed during layout phase) */
  width?: number;
  height?: number;
};

/**
 * Checks if a graph is a single edge (Q-node base case)
 */
const isSingleEdge = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>
): { from: VK; to: VK } | undefined => {
  const vertices = Array.from(graph.vertices());
  const edges = Array.from(graph.edges()).filter(e => !e.disabled);

  if (vertices.length === 2 && edges.length === 1 && edges[0]) {
    return { from: edges[0].from, to: edges[0].to };
  }

  return undefined;
};

/**
 * Finds a vertex that forms a series composition point
 * (a vertex of degree 2 that, when removed, splits the graph)
 */
const findSeriesVertex = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  source: VK,
  sink: VK
): VK | undefined => {
  const adjacencyList = graph.adjacencyList();

  // Build reverse adjacency (incoming edges)
  const reverseAdj = new Map<VK, VK[]>();
  for (const edge of graph.edges()) {
    if (edge.disabled) continue;
    if (!reverseAdj.has(edge.to)) {
      reverseAdj.set(edge.to, []);
    }
    reverseAdj.get(edge.to)!.push(edge.from);
  }

  // Look for vertex with exactly one incoming and one outgoing edge (not source or sink)
  for (const vertex of graph.vertices()) {
    if (vertex.id === source || vertex.id === sink) continue;

    const outgoing = adjacencyList.get(vertex.id) ?? [];
    const incoming = reverseAdj.get(vertex.id) ?? [];

    const outgoingActive = outgoing.filter(n => !n.edge.disabled);
    const incomingActive = incoming;

    if (outgoingActive.length === 1 && incomingActive.length === 1) {
      return vertex.id;
    }
  }

  return undefined;
};

/**
 * Checks if there are parallel paths between source and sink
 */
const hasParallelPaths = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  source: VK,
  sink: VK
): boolean => {
  const adjacencyList = graph.adjacencyList();

  // Count direct edges from source to sink
  const directEdges = (adjacencyList.get(source) ?? []).filter(
    n => !n.edge.disabled && n.vertexId === sink
  );

  if (directEdges.length > 1) {
    return true;
  }

  // Find all paths from source to sink using DFS
  let pathCount = 0;

  const dfs = (current: VK, target: VK, path: Set<VK>): void => {
    if (current === target) {
      pathCount++;
      return;
    }

    if (pathCount > 1) return; // Early exit

    const neighbors = adjacencyList.get(current) ?? [];
    for (const { vertexId, edge } of neighbors) {
      if (!edge.disabled && !path.has(vertexId)) {
        path.add(vertexId);
        dfs(vertexId, target, path);
        path.delete(vertexId);
      }
    }
  };

  const path = new Set<VK>([source]);
  dfs(source, sink, path);

  return pathCount > 1;
};

/**
 * Decomposes a series-parallel graph into a decomposition tree
 */
const decomposeSeriesParallel = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  source: VK,
  sink: VK,
  idCounter: { value: number }
): SPDecompositionNode<VK> | undefined => {
  // Base case: single edge
  const singleEdge = isSingleEdge(graph);
  if (singleEdge) {
    return {
      type: 'Q',
      id: `q_${idCounter.value++}`,
      source: singleEdge.from,
      sink: singleEdge.to
    };
  }

  // Check for parallel composition FIRST (before series)
  if (hasParallelPaths(graph, source, sink)) {
    // Find all edge-disjoint paths from source to sink
    const children: SPDecompositionNode<VK>[] = [];
    const allEdges = Array.from(graph.edges()).filter(e => !e.disabled);
    const remainingEdges = new Set(allEdges);
    const adjacencyList = graph.adjacencyList();

    while (remainingEdges.size > 0) {
      // Find one path from source to sink using only remaining edges
      const path: typeof graph.edges extends () => Iterable<infer T> ? T[] : never = [];
      const pathVertices = new Set<VK>();
      const visited = new Set<VK>();

      const findPath = (current: VK): boolean => {
        if (current === sink) {
          pathVertices.add(current);
          return true;
        }

        visited.add(current);
        pathVertices.add(current);

        const neighbors = adjacencyList.get(current) ?? [];
        for (const { vertexId, edge } of neighbors) {
          if (!visited.has(vertexId) && remainingEdges.has(edge)) {
            path.push(edge);
            if (findPath(vertexId)) {
              return true;
            }
            path.pop();
          }
        }

        pathVertices.delete(current);
        return false;
      };

      if (!findPath(source)) {
        break; // No more paths found
      }

      // Create subgraph for this path
      const pathVerts = Array.from(pathVertices)
        .map(id => graph.getVertex(id)!)
        .filter(v => v);
      const subgraph = graph.subgraph(pathVerts, path);

      const child = decomposeSeriesParallel(subgraph, source, sink, idCounter);
      if (child) {
        children.push(child);
      }

      // Remove edges from this path
      for (const edge of path) {
        remainingEdges.delete(edge);
      }
    }

    if (children.length > 1) {
      return {
        type: 'P',
        id: `p_${idCounter.value++}`,
        source,
        sink,
        children
      };
    } else if (children.length === 1) {
      // Only one path found, return it directly
      return children[0];
    }
  }

  // Check for series composition
  const seriesVertex = findSeriesVertex(graph, source, sink);
  if (seriesVertex) {
    // Split graph at series vertex
    const vertices1 = new Set<VK>();
    const vertices2 = new Set<VK>();
    const edges1: typeof graph.edges extends () => Iterable<infer T> ? T[] : never = [];
    const edges2: typeof graph.edges extends () => Iterable<infer T> ? T[] : never = [];

    // First subgraph: source to seriesVertex
    vertices1.add(source);
    vertices1.add(seriesVertex);

    // Second subgraph: seriesVertex to sink
    vertices2.add(seriesVertex);
    vertices2.add(sink);

    const adjacencyList = graph.adjacencyList();
    const visited = new Set<VK>();

    // Find all vertices reachable from source before seriesVertex
    const dfs1 = (v: VK): void => {
      if (v === seriesVertex || visited.has(v)) return;
      visited.add(v);
      vertices1.add(v);
      const neighbors = adjacencyList.get(v) ?? [];
      for (const { vertexId, edge } of neighbors) {
        if (!edge.disabled) {
          edges1.push(edge);
          dfs1(vertexId);
        }
      }
    };
    dfs1(source);

    // Find all vertices reachable from seriesVertex to sink
    visited.clear();
    const dfs2 = (v: VK): void => {
      if (visited.has(v)) return;
      visited.add(v);
      vertices2.add(v);
      const neighbors = adjacencyList.get(v) ?? [];
      for (const { vertexId, edge } of neighbors) {
        if (!edge.disabled) {
          edges2.push(edge);
          dfs2(vertexId);
        }
      }
    };
    dfs2(seriesVertex);

    // Create subgraphs
    const verts1 = Array.from(vertices1).map(id => graph.getVertex(id)!).filter(v => v);
    const verts2 = Array.from(vertices2).map(id => graph.getVertex(id)!).filter(v => v);

    const subgraph1 = graph.subgraph(verts1, edges1);
    const subgraph2 = graph.subgraph(verts2, edges2);

    // Recursively decompose
    const child1 = decomposeSeriesParallel(subgraph1, source, seriesVertex, idCounter);
    const child2 = decomposeSeriesParallel(subgraph2, seriesVertex, sink, idCounter);

    if (child1 && child2) {
      return {
        type: 'S',
        id: `s_${idCounter.value++}`,
        source,
        sink,
        children: [child1, child2]
      };
    }
  }

  // Not a series-parallel graph
  return undefined;
};

/**
 * Computes layout positions from decomposition tree
 */
const computeLayoutFromDecomposition = <VK>(
  node: SPDecompositionNode<VK>,
  horizontalSpacing: number,
  verticalSpacing: number
): Map<VK, Point> => {
  const positions = new Map<VK, Point>();

  const layout = (n: SPDecompositionNode<VK>, offsetX: number, offsetY: number): void => {
    if (n.type === 'Q') {
      // Q-node: single edge, source at top, sink at bottom
      if (!positions.has(n.source)) {
        positions.set(n.source, { x: offsetX, y: offsetY });
      }
      if (!positions.has(n.sink)) {
        positions.set(n.sink, { x: offsetX, y: offsetY + verticalSpacing });
      }
      n.width = 1;
      n.height = 1;
    } else if (n.type === 'S') {
      // S-node: stack children vertically
      let currentY = offsetY;
      let maxWidth = 0;

      for (const child of n.children ?? []) {
        layout(child, offsetX, currentY);
        maxWidth = Math.max(maxWidth, child.width ?? 1);
        currentY += (child.height ?? 1) * verticalSpacing;
      }

      // Center narrower children
      for (const child of n.children ?? []) {
        const childWidth = child.width ?? 1;
        if (childWidth < maxWidth) {
          const centerOffset = ((maxWidth - childWidth) * horizontalSpacing) / 2;
          // Adjust all positions in this child
          const childPositions = Array.from(positions.entries()).filter(([, pos]) => {
            const childPos = positions.get(child.source);
            return childPos && Math.abs(pos.y - childPos.y) < currentY - offsetY;
          });
          for (const [id, pos] of childPositions) {
            positions.set(id, { x: pos.x + centerOffset, y: pos.y });
          }
        }
      }

      n.width = maxWidth;
      n.height = (n.children ?? []).reduce((sum, c) => sum + (c.height ?? 1), 0);
    } else if (n.type === 'P') {
      // P-node: arrange children horizontally
      // For parallel composition, source and sink are shared
      // Layout source and sink first
      if (!positions.has(n.source)) {
        positions.set(n.source, { x: offsetX, y: offsetY });
      }

      let currentX = offsetX;
      let maxHeight = 0;

      for (const child of n.children ?? []) {
        layout(child, currentX, offsetY);
        currentX += (child.width ?? 1) * horizontalSpacing;
        maxHeight = Math.max(maxHeight, child.height ?? 1);
      }

      // Sink should be positioned at the end
      if (!positions.has(n.sink)) {
        positions.set(n.sink, { x: offsetX, y: offsetY + maxHeight * verticalSpacing });
      }

      n.width = (n.children ?? []).reduce((sum, c) => sum + (c.width ?? 1), 0);
      n.height = maxHeight;
    }
  };

  layout(node, 0, 0);
  return positions;
};

/**
 * Applies direction transformation to positions
 */
const transformPositions = <VK>(
  positions: Map<VK, Point>,
  direction: 'down' | 'up' | 'left' | 'right'
): Map<VK, Point> => {
  const transformed = new Map<VK, Point>();

  for (const [id, pos] of positions) {
    let point: Point;
    const x = pos.x === 0 ? 0 : pos.x;
    const y = pos.y === 0 ? 0 : pos.y;

    switch (direction) {
      case 'down':
        point = { x, y };
        break;
      case 'up':
        point = { x, y: y === 0 ? 0 : -y };
        break;
      case 'left':
        point = { x: y === 0 ? 0 : -y, y: x };
        break;
      case 'right':
        point = { x: y, y: x };
        break;
    }

    transformed.set(id, point);
  }

  return transformed;
};

/**
 * Lays out vertices in a series-parallel graph structure.
 *
 * Series-parallel graphs are characterized by recursive composition of
 * series (sequential) and parallel structures. This algorithm:
 * - Recognizes series-parallel decomposition
 * - Stacks series structures vertically
 * - Arranges parallel structures horizontally
 * - Falls back to layered layout for non-SP graphs
 *
 * This algorithm is ideal for:
 * - Flow diagrams with clear series/parallel structure
 * - Circuit diagrams (series and parallel circuits)
 * - PERT/CPM diagrams
 * - Process flows with parallel branches
 *
 * @param graph - The graph to layout
 * @param startIds - IDs of vertices to start layout from (determines connected component)
 * @param options - Layout options
 * @returns Map of vertex IDs to 2D positions
 *
 * @example
 * ```ts
 * const positions = layoutSeriesParallel(graph, ['start'], {
 *   horizontalSpacing: 2,
 *   verticalSpacing: 1.5,
 *   direction: 'down',
 *   fallbackToLayered: true
 * });
 * ```
 */
export const layoutSeriesParallel = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startIds: VK[],
  options: SeriesParallelLayoutOptions = {}
): Map<VK, Point> => {
  const {
    horizontalSpacing = 1,
    verticalSpacing = 1,
    direction = 'down',
    fallbackToLayered = true
  } = options;

  if (startIds.length === 0) {
    return new Map();
  }

  // Check if start vertex exists
  const startVertex = graph.getVertex(startIds[0]!);
  if (!startVertex) {
    return new Map();
  }

  // Get connected component
  const component = getConnectedComponent(graph, startIds[0]!);
  if (!component) {
    return new Map();
  }

  const componentVertices = new Set(component.vertices.map(v => v.id));

  // Calculate in-degree and out-degree
  const inDegree = new Map<VK, number>();
  const outDegree = new Map<VK, number>();

  for (const vertexId of componentVertices) {
    inDegree.set(vertexId, 0);
    outDegree.set(vertexId, 0);
  }

  for (const edge of graph.edges()) {
    if (edge.disabled) continue;
    if (componentVertices.has(edge.from) && componentVertices.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    }
  }

  // Find sources (in-degree 0) and sinks (out-degree 0)
  const sources: VK[] = [];
  const sinks: VK[] = [];

  for (const vertexId of componentVertices) {
    if (inDegree.get(vertexId) === 0) {
      sources.push(vertexId);
    }
    if (outDegree.get(vertexId) === 0) {
      sinks.push(vertexId);
    }
  }

  // If not exactly one source and one sink, fall back to layered layout
  if (sources.length !== 1 || sinks.length !== 1) {
    if (fallbackToLayered) {
      return layoutLayered(graph, startIds, {
        horizontalSpacing,
        verticalSpacing,
        direction
      });
    }
    return new Map();
  }

  const source = sources[0]!;
  const sink = sinks[0]!;

  // Create subgraph with only the connected component
  const subgraph = graph.subgraph(component.vertices, component.edges);

  // Attempt series-parallel decomposition
  const idCounter = { value: 0 };
  const decomposition = decomposeSeriesParallel(subgraph, source, sink, idCounter);

  if (!decomposition) {
    // Not a series-parallel graph, fall back to layered layout
    if (fallbackToLayered) {
      return layoutLayered(graph, startIds, {
        horizontalSpacing,
        verticalSpacing,
        direction
      });
    }
    return new Map();
  }

  // Compute layout from decomposition
  const positions = computeLayoutFromDecomposition(decomposition, horizontalSpacing, verticalSpacing);

  // Apply direction transformation
  return transformPositions(positions, direction);
};
