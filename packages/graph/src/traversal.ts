import type { Edge, Graph, Vertex } from './graph';
import { MultiMap } from '@diagram-craft/utils/multimap';

/**
 * Builds an adjacency map for graph traversal.
 *
 * @param graph - The graph to build adjacency map from
 * @param respectDirectionality - If true, uses directed edges; if false, treats all edges as bidirectional
 * @returns MultiMap with vertex adjacencies
 */
function buildAdjacencyMap<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  respectDirectionality: boolean
): MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }> {
  if (respectDirectionality) {
    return graph.adjacencyList();
  }

  const adjacencyMap = new MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }>();
  for (const edge of graph.edges()) {
    if (edge.disabled) continue;

    adjacencyMap.add(edge.from, { vertexId: edge.to, edge });
    adjacencyMap.add(edge.to, { vertexId: edge.from, edge });
  }

  return adjacencyMap;
}

/**
 * Performs DFS traversal starting from a given vertex, yielding vertices and edges
 * that form a spanning tree.
 *
 * @param graph - The graph to traverse
 * @param startId - The ID of the starting vertex
 * @param options - Traversal options
 * @returns Generator yielding vertices and edges in DFS order
 */
export function* dfs<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startId: VK,
  options?: {
    respectDirectionality?: boolean;
  }
): Generator<{ vertex: Vertex<V, VK>; edge?: Edge<E, EK, VK> }> {
  const adjacencyMap = buildAdjacencyMap(graph, options?.respectDirectionality ?? false);

  const visited = new Set<VK>();
  const stack: Array<{ vertexId: VK; edge?: Edge<E, EK, VK> }> = [{ vertexId: startId }];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (visited.has(current.vertexId)) continue;
    visited.add(current.vertexId);

    const currentVertex = graph.getVertex(current.vertexId);
    if (!currentVertex) continue;

    yield { vertex: currentVertex, edge: current.edge };

    const neighbors = adjacencyMap.get(current.vertexId) ?? [];
    for (const { vertexId: neighborId, edge } of neighbors) {
      if (!visited.has(neighborId)) {
        stack.push({ vertexId: neighborId, edge });
      }
    }
  }
}

/**
 * Performs BFS traversal starting from a given vertex, yielding vertices and edges
 * that form a spanning tree.
 *
 * @param graph - The graph to traverse
 * @param startId - The ID of the starting vertex
 * @param options - Traversal options
 * @returns Generator yielding vertices and edges in BFS order
 */
export function* bfs<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startId: VK,
  options?: {
    respectDirectionality?: boolean;
  }
): Generator<{ vertex: Vertex<V, VK>; edge?: Edge<E, EK, VK> }> {
  const adjacencyMap = buildAdjacencyMap(graph, options?.respectDirectionality ?? false);

  const visited = new Set<VK>();
  const queued = new Set<VK>();
  const queue: Array<{ vertexId: VK; edge?: Edge<E, EK, VK> }> = [{ vertexId: startId }];
  queued.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.vertexId)) continue;
    visited.add(current.vertexId);

    const currentVertex = graph.getVertex(current.vertexId);
    if (!currentVertex) continue;

    yield { vertex: currentVertex, edge: current.edge };

    const neighbors = adjacencyMap.get(current.vertexId) ?? [];
    for (const { vertexId: neighborId, edge } of neighbors) {
      if (!queued.has(neighborId)) {
        queue.push({ vertexId: neighborId, edge });
        queued.add(neighborId);
      }
    }
  }
}
