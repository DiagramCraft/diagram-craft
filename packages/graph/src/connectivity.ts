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

  for (const { vertex } of dfs(graph, startId)) {
    vertices.push(vertex);
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

/**
 * Gets all connected components in a graph, optionally starting from a specific set of vertices.
 * Returns the full connected components, not just the subset.
 *
 * @param graph The graph to analyze
 * @param vertexIds Optional set of vertex IDs to use as starting points. If provided, only components
 *                  containing at least one of these vertices will be returned. If not provided, all
 *                  components in the graph are returned.
 * @returns An array of connected components, each containing the full set of vertices and edges
 */
export const getConnectedComponents = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  vertexIds?: Set<VK>
): ConnectedComponent<V, E, VK, EK>[] => {
  const visited = new Set<VK>();
  const components: ConnectedComponent<V, E, VK, EK>[] = [];

  const verticesToConsider = vertexIds
    ? Array.from(vertexIds).map(id => graph.getVertex(id)).filter((v): v is Vertex<V, VK> => v !== undefined)
    : Array.from(graph.vertices());

  for (const vertex of verticesToConsider) {
    if (visited.has(vertex.id)) continue;

    const component = getConnectedComponent(graph, vertex.id);
    if (component) {
      components.push(component);
      for (const v of component.vertices) {
        visited.add(v.id);
      }
    }
  }

  return components;
};
