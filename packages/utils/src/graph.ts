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

/** A graph containing vertices and edges with method-based access */
export interface Graph<V = unknown, E = unknown, K = string> {
  /** Get a vertex by its ID */
  getVertex(id: K): Vertex<V, K> | undefined;

  /** Get an edge by its ID */
  getEdge(id: K): Edge<E, K> | undefined;

  /** Get an iterable of all vertices */
  vertices(): Iterable<Vertex<V, K>>;

  /** Get an iterable of all edges */
  edges(): Iterable<Edge<E, K>>;
}

/** A simple implementation of the Graph interface using Maps */
export class SimpleGraph<V = unknown, E = unknown, K = string> implements Graph<V, E, K> {
  protected _vertices = new Map<K, Vertex<V, K>>();
  protected _edges = new Map<K, Edge<E, K>>();

  getVertex(id: K): Vertex<V, K> | undefined {
    return this._vertices.get(id);
  }

  getEdge(id: K): Edge<E, K> | undefined {
    return this._edges.get(id);
  }

  vertices(): Iterable<Vertex<V, K>> {
    return this._vertices.values();
  }

  edges(): Iterable<Edge<E, K>> {
    return this._edges.values();
  }

  /** Add a vertex to the graph */
  addVertex(vertex: Vertex<V, K>): Vertex<V, K> {
    this._vertices.set(vertex.id, vertex);
    return vertex;
  }

  /** Add an edge to the graph */
  addEdge(edge: Edge<E, K>): Edge<E, K> {
    this._edges.set(edge.id, edge);
    return edge;
  }

  removeEdge(edge: K): boolean {
    return this._edges.delete(edge);
  }

  removeVertex(vertex: K): boolean {
    return this._vertices.delete(vertex);
  }
}

/** Result of shortest path calculation */
export interface ShortestPathResult<V = unknown, E = unknown, K = string> {
  path: Vertex<V, K>[];
  distance: number;
  edges: Edge<E, K>[];
}

/**
 * Edge penalty function for A* algorithm that calculates additional penalty for an edge.
 * @param currentVertex The vertex we're currently at
 * @param proposedEdge The edge we're considering taking
 * @param graph The graph being searched
 * @returns Additional penalty to add to the edge weight
 */
export type EdgePenaltyFunction<V = unknown, E = unknown, K = string> = (
  currentVertex: Vertex<V, K>,
  proposedEdge: Edge<E, K>,
  graph: Graph<V, E, K>
) => number | undefined;

/**
 * Heuristic function for A* algorithm that estimates the distance from a vertex to the goal.
 * @param fromVertex The vertex to estimate distance from
 * @param toVertex The target vertex
 * @param graph The graph being searched
 * @returns Estimated distance from fromVertex to toVertex (must be admissible)
 */
export type HeuristicFunction<V = unknown, E = unknown, K = string> = (
  fromVertex: Vertex<V, K>,
  toVertex: Vertex<V, K>,
  graph: Graph<V, E, K>
) => number;

/**
 * Finds the shortest path between two vertices using the A* algorithm.
 * @param graph The graph to search in
 * @param startId ID of the starting vertex
 * @param endId ID of the destination vertex
 * @param heuristicFunction Function that estimates distance from any vertex to the goal
 * @param penaltyFunction Optional function to add path-independent penalties to edge weights
 * @returns Shortest path result or undefined if no path exists
 */
export const findShortestPathAStar = <V = unknown, E = unknown, K = string>(
  graph: Graph<V, E, K>,
  startId: K,
  endId: K,
  heuristicFunction: HeuristicFunction<V, E, K>,
  penaltyFunction?: EdgePenaltyFunction<V, E, K>
): ShortestPathResult<V, E, K> | undefined => {
  const startVertex = graph.getVertex(startId);
  const endVertex = graph.getVertex(endId);

  if (!startVertex || !endVertex) {
    return undefined;
  }

  // gScore: cost of cheapest path from start to vertex
  const gScore = new Map<K, number>();
  // fScore: gScore + heuristic estimate to goal
  const fScore = new Map<K, number>();
  const previous = new Map<K, { vertex: Vertex<V, K>; edge: Edge<E, K> }>();
  const visited = new Set<K>();
  const queue = new PriorityQueue<K>();

  // Initialize scores
  for (const vertex of graph.vertices()) {
    gScore.set(vertex.id, vertex.id === startId ? 0 : Infinity);
    fScore.set(
      vertex.id,
      vertex.id === startId ? heuristicFunction(startVertex, endVertex, graph) : Infinity
    );
  }

  queue.enqueue(startId, fScore.get(startId)!);

  // Build adjacency list for efficient lookup
  const adjacencyList = new MultiMap<K, { vertexId: K; edge: Edge<E, K> }>();
  for (const edge of graph.edges()) {
    adjacencyList.add(edge.from, { vertexId: edge.to, edge });
  }

  while (!queue.isEmpty()) {
    const currentId = queue.dequeue()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === endId) break;

    const currentGScore = gScore.get(currentId)!;
    const neighbors = (adjacencyList.get(currentId) ?? []).filter(n => n.edge.disabled !== true);

    for (const { vertexId: neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) continue;

      const currentVertex = graph.getVertex(currentId)!;
      const neighborVertex = graph.getVertex(neighborId)!;

      let edgeWeight = edge.weight;
      if (penaltyFunction) {
        const penalty = penaltyFunction(currentVertex, edge, graph) ?? 0;
        edgeWeight += penalty;
      }

      const tentativeGScore = currentGScore + edgeWeight;
      const currentNeighborGScore = gScore.get(neighborId)!;

      if (tentativeGScore < currentNeighborGScore) {
        // This path to neighbor is better than any previous one
        previous.set(neighborId, { vertex: currentVertex, edge: edge });
        gScore.set(neighborId, tentativeGScore);
        const heuristic = heuristicFunction(neighborVertex, endVertex, graph);
        const newFScore = tentativeGScore + heuristic;
        fScore.set(neighborId, newFScore);

        // Add to queue with f-score as priority
        queue.enqueue(neighborId, newFScore);
      }
    }
  }

  // Reconstruct path
  const path: Vertex<V, K>[] = [];
  const pathEdges: Edge<E, K>[] = [];
  let currentId = endId;

  while (currentId !== startId) {
    const vertex = graph.getVertex(currentId)!;
    path.unshift(vertex);

    const prev = previous.get(currentId);
    if (!prev) return undefined; // No path found

    const edge = prev.edge;
    pathEdges.unshift(edge);
    currentId = prev.vertex.id;
  }

  // Add start vertex
  path.unshift(startVertex);

  const finalDistance = gScore.get(endId)!;
  if (finalDistance === Infinity) return undefined; // No path found

  return {
    path,
    distance: finalDistance,
    edges: pathEdges
  };
};
