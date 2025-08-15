import { PriorityQueue } from './priorityQueue';
import { MultiMap } from './multimap';

/** A vertex in a graph with optional typed data */
export interface Vertex<T = unknown, K = string> {
  id: K;
  data: T;
}

/** An edge connecting two vertices with optional weight and typed data */
export interface Edge<T = unknown, K = string> {
  id: K;
  from: K;
  to: K;
  weight: number;
  data: T;
  disabled?: boolean;
}

/** A graph containing vertices and edges as Maps */
export interface Graph<V = unknown, E = unknown, K = string> {
  vertices: Map<K, Vertex<V, K>>;
  edges: Map<K, Edge<E, K>>;
}

/** Result of shortest path calculation */
export interface ShortestPathResult<V = unknown, E = unknown, K = string> {
  path: Vertex<V, K>[];
  distance: number;
  edges: Edge<E, K>[];
}

/**
 * Function that calculates additional penalty for an edge based on path context.
 * @param previousEdge The edge that led to the current vertex (undefined for start vertex)
 * @param currentVertex The vertex we're currently at
 * @param proposedEdge The edge we're considering taking
 * @returns Additional penalty to add to the edge weight
 */
export type EdgePenaltyFunction<V = unknown, E = unknown, K = string> = (
  previousEdge: Edge<E, K> | undefined,
  currentVertex: Vertex<V, K>,
  proposedEdge: Edge<E, K>,
  graph: Graph<V, E, K>
) => number | undefined;

/**
 * Finds the shortest path between two vertices using Dijkstra's algorithm.
 * @param graph The graph to search in
 * @param startId ID of the starting vertex
 * @param endId ID of the destination vertex
 * @param penaltyFunction Optional function to add path-dependent penalties to edge weights
 * @returns Shortest path result or undefined if no path exists
 */
export const findShortestPath = <V = unknown, E = unknown, K = string>(
  graph: Graph<V, E, K>,
  startId: K,
  endId: K,
  penaltyFunction?: EdgePenaltyFunction<V, E, K>
): ShortestPathResult<V, E, K> | undefined => {
  const startVertex = graph.vertices.get(startId);
  const endVertex = graph.vertices.get(endId);

  if (!startVertex || !endVertex) {
    return undefined;
  }

  const distances = new Map<K, number>();
  const previous = new Map<K, { vertex: Vertex<V, K>; edge: Edge<E, K> }>();
  const visited = new Set<K>();
  const queue = new PriorityQueue<K>();

  // Initialize distances
  for (const [vertexId] of graph.vertices) {
    distances.set(vertexId, vertexId === startId ? 0 : Infinity);
  }

  queue.enqueue(startId, 0);

  // Build adjacency list for efficient lookup
  const adjacencyList = new MultiMap<K, { vertexId: K; edge: Edge<E, K> }>();
  for (const [, edge] of graph.edges) {
    adjacencyList.add(edge.from, { vertexId: edge.to, edge });
  }

  while (!queue.isEmpty()) {
    const currentId = queue.dequeue()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === endId) break;

    const currentDistance = distances.get(currentId)!;
    const neighbors = (adjacencyList.get(currentId) ?? []).filter(n => n.edge.disabled !== true);

    for (const { vertexId: neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) continue;

      const currentVertex = graph.vertices.get(currentId)!;
      const previousInfo = previous.get(currentId);
      const previousEdge = previousInfo ? previousInfo.edge : undefined;

      let edgeWeight = edge.weight;
      if (penaltyFunction) {
        const penalty = penaltyFunction(previousEdge, currentVertex, edge, graph) ?? 0;
        edgeWeight += penalty;
      }

      const newDistance = currentDistance + edgeWeight;
      const currentNeighborDistance = distances.get(neighborId)!;

      if (newDistance < currentNeighborDistance) {
        distances.set(neighborId, newDistance);
        previous.set(neighborId, { vertex: currentVertex, edge: edge });
        queue.enqueue(neighborId, newDistance);
      }
    }
  }

  // Reconstruct path
  const path: Vertex<V, K>[] = [];
  const pathEdges: Edge<E, K>[] = [];
  let currentId = endId;

  while (currentId !== startId) {
    const vertex = graph.vertices.get(currentId)!;
    path.unshift(vertex);

    const prev = previous.get(currentId);
    if (!prev) return undefined; // No path found

    const edge = prev.edge;
    pathEdges.unshift(edge);
    currentId = prev.vertex.id;
  }

  // Add start vertex
  path.unshift(startVertex);

  const finalDistance = distances.get(endId)!;
  if (finalDistance === Infinity) return undefined; // No path found

  return {
    path,
    distance: finalDistance,
    edges: pathEdges
  };
};
