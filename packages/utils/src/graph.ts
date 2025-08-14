import { PriorityQueue } from './priorityQueue';

/** A vertex in a graph with optional typed data */
export interface Vertex<T = unknown> {
  id: string;
  data?: T;
}

/** An edge connecting two vertices with optional weight and typed data */
export interface Edge<T = unknown> {
  id: string;
  from: string;
  to: string;
  weight?: number;
  data?: T;
}

/** A graph containing vertices and edges as Maps */
export interface Graph<V = unknown, E = unknown> {
  vertices: Map<string, Vertex<V>>;
  edges: Map<string, Edge<E>>;
}

/** Result of shortest path calculation */
export interface ShortestPathResult<V = unknown, E = unknown> {
  path: Vertex<V>[];
  distance: number;
  edges: Edge<E>[];
}

/** 
 * Function that calculates additional penalty for an edge based on path context.
 * @param previousEdge The edge that led to the current vertex (undefined for start vertex)
 * @param currentVertex The vertex we're currently at
 * @param proposedEdge The edge we're considering taking
 * @returns Additional penalty to add to the edge weight
 */
export type EdgePenaltyFunction<V = unknown, E = unknown> = (
  previousEdge: Edge<E> | undefined,
  currentVertex: Vertex<V>,
  proposedEdge: Edge<E>
) => number;

/**
 * Finds the shortest path between two vertices using Dijkstra's algorithm.
 * @param graph The graph to search in
 * @param startId ID of the starting vertex
 * @param endId ID of the destination vertex
 * @param penaltyFunction Optional function to add path-dependent penalties to edge weights
 * @returns Shortest path result or undefined if no path exists
 */
export const findShortestPath = <V = unknown, E = unknown>(
  graph: Graph<V, E>,
  startId: string,
  endId: string,
  penaltyFunction?: EdgePenaltyFunction<V, E>
): ShortestPathResult<V, E> | undefined => {
  const startVertex = graph.vertices.get(startId);
  const endVertex = graph.vertices.get(endId);

  if (!startVertex || !endVertex) {
    return undefined;
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, { vertex: string; edge: string }>();
  const visited = new Set<string>();
  const queue = new PriorityQueue<string>();

  // Initialize distances
  for (const [vertexId] of graph.vertices) {
    distances.set(vertexId, vertexId === startId ? 0 : Infinity);
  }

  queue.enqueue(startId, 0);

  // Build adjacency list for efficient lookup
  const adjacencyList = new Map<string, Array<{ vertexId: string; edge: Edge<E> }>>();
  for (const [, edge] of graph.edges) {
    if (!adjacencyList.has(edge.from)) {
      adjacencyList.set(edge.from, []);
    }
    adjacencyList.get(edge.from)!.push({ vertexId: edge.to, edge });
  }

  while (!queue.isEmpty()) {
    const currentId = queue.dequeue()!;
    
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    if (currentId === endId) {
      break;
    }

    const currentDistance = distances.get(currentId)!;
    const neighbors = adjacencyList.get(currentId) || [];

    for (const { vertexId: neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }

      const currentVertex = graph.vertices.get(currentId)!;
      const previousInfo = previous.get(currentId);
      const previousEdge = previousInfo ? graph.edges.get(previousInfo.edge) : undefined;
      
      let edgeWeight = edge.weight ?? 1;
      if (penaltyFunction) {
        const penalty = penaltyFunction(previousEdge, currentVertex, edge);
        edgeWeight += penalty;
      }
      
      const newDistance = currentDistance + edgeWeight;
      const currentNeighborDistance = distances.get(neighborId)!;

      if (newDistance < currentNeighborDistance) {
        distances.set(neighborId, newDistance);
        previous.set(neighborId, { vertex: currentId, edge: edge.id });
        queue.enqueue(neighborId, newDistance);
      }
    }
  }

  // Reconstruct path
  const path: Vertex<V>[] = [];
  const pathEdges: Edge<E>[] = [];
  let currentId = endId;

  while (currentId !== startId) {
    const vertex = graph.vertices.get(currentId)!;
    path.unshift(vertex);

    const prev = previous.get(currentId);
    if (!prev) {
      return undefined; // No path found
    }

    const edge = graph.edges.get(prev.edge)!;
    pathEdges.unshift(edge);
    currentId = prev.vertex;
  }

  // Add start vertex
  path.unshift(startVertex);

  const finalDistance = distances.get(endId)!;
  
  if (finalDistance === Infinity) {
    return undefined; // No path found
  }

  return {
    path,
    distance: finalDistance,
    edges: pathEdges
  };
};

