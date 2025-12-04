import type { Edge, Graph } from './graph';
import { MultiMap } from '@diagram-craft/utils/multimap';

export function* dfs<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startId: VK,
  options?: {
    respectDirectionality?: boolean;
  }
) {
  let adjacencyMap: MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }>;
  if (options?.respectDirectionality) {
    adjacencyMap = graph.adjacencyList();
  } else {
    adjacencyMap = new MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }>();
    for (const edge of graph.edges()) {
      if (edge.disabled) continue;

      adjacencyMap.add(edge.from, { vertexId: edge.to, edge });
      adjacencyMap.add(edge.to, { vertexId: edge.from, edge });
    }
  }

  const visited = new Set<VK>();
  const queue: VK[] = [startId];
  // BFS to find all connected vertices
  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentVertex = graph.getVertex(currentId);
    if (!currentVertex) continue;

    yield currentVertex;

    const neighbors = adjacencyMap.get(currentId) ?? [];
    for (const { vertexId: neighborId } of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push(neighborId);
      }
    }
  }
}
