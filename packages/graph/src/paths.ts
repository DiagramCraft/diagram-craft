/**
 * Shortest path algorithms for graphs.
 *
 * @example
 * ```ts
 * import { findShortestPathAStar } from '@diagram-craft/graph/paths';
 * import { SimpleGraph } from '@diagram-craft/graph/graph';
 *
 * const graph = new SimpleGraph();
 * graph.addVertex({ id: 'A', data: {} });
 * graph.addVertex({ id: 'B', data: {} });
 * graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
 *
 * const result = findShortestPathAStar(
 *   graph,
 *   'A',
 *   'B',
 *   (from, to) => 0 // heuristic function
 * );
 * ```
 *
 * @module
 */

import { PriorityQueue } from '@diagram-craft/utils/priorityQueue';
import type { Edge, Graph, Vertex } from './graph';

/** Result of shortest path calculation */
export interface ShortestPathResult<V = unknown, E = unknown, VK = string, EK = string> {
  path: Vertex<V, VK>[];
  distance: number;
  edges: Edge<E, EK, VK>[];
}

/**
 * Edge penalty function for A* algorithm that calculates additional penalty for an edge.
 * @param previousEdge The edge we came from (undefined if at start vertex)
 * @param currentVertex The vertex we're currently at
 * @param proposedEdge The edge we're considering taking
 * @param graph The graph being searched
 * @returns Multiplicative penalty to add to the edge weight
 */
export type EdgePenaltyFunction<V = unknown, E = unknown, VK = string, EK = string> = (
  previousEdge: Edge<E, EK, VK> | undefined,
  currentVertex: Vertex<V, VK>,
  proposedEdge: Edge<E, EK, VK>,
  graph: Graph<V, E, VK, EK>
) => number | undefined;

/**
 * Heuristic function for A* algorithm that estimates the distance from a vertex to the goal.
 * @param fromVertex The vertex to estimate distance from
 * @param toVertex The target vertex
 * @param graph The graph being searched
 * @returns Estimated distance from fromVertex to toVertex (must be admissible)
 */
export type HeuristicFunction<V = unknown, E = unknown, VK = string, EK = string> = (
  fromVertex: Vertex<V, VK>,
  toVertex: Vertex<V, VK>,
  graph: Graph<V, E, VK, EK>
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
export const findShortestPathAStar = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startId: VK,
  endId: VK,
  heuristicFunction: HeuristicFunction<V, E, VK, EK>,
  penaltyFunction?: EdgePenaltyFunction<V, E, VK, EK>
): ShortestPathResult<V, E, VK, EK> | undefined => {
  const startVertex = graph.getVertex(startId);
  const endVertex = graph.getVertex(endId);

  if (!startVertex || !endVertex) {
    return undefined;
  }

  // Build adjacency list for efficient lookup
  const adjacencyList = graph.adjacencyList();

  // gScore: cost of cheapest path from start to vertex
  const gScore = new Map<VK, number>();
  // fScore: gScore + heuristic estimate to goal
  const fScore = new Map<VK, number>();
  const previous = new Map<VK, { vertex: Vertex<V, VK>; edge: Edge<E, EK, VK> }>();
  const visited = new Set<VK>();
  const queue = new PriorityQueue<VK>();

  // Lazy score accessor - only initialize when needed
  const getGScore = (id: VK): number => {
    const existing = gScore.get(id);
    return existing !== undefined ? existing : Infinity;
  };

  // Initialize only the start vertex scores
  const startHeuristic = heuristicFunction(startVertex, endVertex, graph);
  gScore.set(startId, 0);
  fScore.set(startId, startHeuristic);

  queue.enqueue(startId, startHeuristic);

  while (!queue.isEmpty()) {
    const currentId = queue.dequeue()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === endId) break;

    const currentGScore = getGScore(currentId);
    const neighbors = (adjacencyList.get(currentId) ?? []).filter(n => n.edge.disabled !== true);

    for (const { vertexId: neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) continue;

      const currentVertex = graph.getVertex(currentId)!;
      const neighborVertex = graph.getVertex(neighborId)!;

      let edgeWeight = edge.weight;
      if (penaltyFunction) {
        edgeWeight *=
          penaltyFunction(previous.get(currentId)?.edge, currentVertex, edge, graph) ?? 1;
      }

      const tentativeGScore = currentGScore + edgeWeight;
      const currentNeighborGScore = getGScore(neighborId);

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
  const path: Vertex<V, VK>[] = [];
  const pathEdges: Edge<E, EK, VK>[] = [];
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

  const finalDistance = getGScore(endId);
  if (finalDistance === Infinity) return undefined; // No path found

  return {
    path,
    distance: finalDistance,
    edges: pathEdges
  };
};
