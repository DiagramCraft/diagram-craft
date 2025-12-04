/**
 * Graph connectivity algorithms.
 *
 * @example
 * ```ts
 * import { getConnectedComponent } from '@diagram-craft/graph/connectivity';
 * import { SimpleGraph } from '@diagram-craft/graph/graph';
 *
 * const graph = new SimpleGraph();
 * graph.addVertex({ id: 'A', data: {} });
 * graph.addVertex({ id: 'B', data: {} });
 * graph.addVertex({ id: 'C', data: {} });
 * graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: {} });
 *
 * const component = getConnectedComponent(graph, 'A');
 * if (component) {
 *   const subgraph = graph.createSubgraph(component.vertices, component.edges);
 * }
 * ```
 *
 * @module
 */

import type { Edge, Graph, Vertex } from './graph';
import { assert } from '@diagram-craft/utils/assert';
import { dfs } from './traversal';

export type ConnectedComponent<V = unknown, E = unknown, VK = string, EK = string> = {
  vertices: Vertex<V, VK>[];
  edges: Edge<E, EK, VK>[];
};

/**
 * Gets the connected component containing a specific vertex.
 * Uses breadth-first search to find all vertices reachable from the starting vertex,
 * treating edges as bidirectional regardless of their direction.
 *
 * @param graph The graph to search in
 * @param startId ID of the starting vertex
 * @returns An object containing arrays of vertices and edges in the connected component,
 *          or undefined if the starting vertex doesn't exist
 */
export const getConnectedComponent = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startId: VK
): ConnectedComponent<V, E, VK, EK> | undefined => {
  assert.present(graph.getVertex(startId));

  const vertices: Vertex<V, VK>[] = [];

  for (const v of dfs(graph, startId)) {
    vertices.push(v);
  }

  const vertexIds = new Set(vertices.map(v => v.id));

  // Add all edges where both vertices are in the component
  const edges: Edge<E, EK, VK>[] = [];
  for (const edge of graph.edges()) {
    if (edge.disabled) continue;

    if (vertexIds.has(edge.from) && vertexIds.has(edge.to)) {
      edges.push(edge);
    }
  }

  return { vertices, edges };
};
