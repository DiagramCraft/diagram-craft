import type { Edge, Graph, Vertex } from './graph';
import { bfs } from './traversal';

/**
 * Extracts the largest tree subgraph rooted at the given vertex.
 *
 * Uses BFS traversal to build a tree by visiting vertices and including edges
 * to unvisited neighbors. This ensures no cycles are included, maintaining
 * the tree property.
 *
 * @param graph - The graph to extract the tree from
 * @param rootId - The ID of the vertex to use as the root
 * @returns An object containing the vertices and edges that form the tree, or undefined if root doesn't exist
 */
export function extractMaximalTree<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  rootId: VK
): { vertices: Vertex<V, VK>[]; edges: Edge<E, EK, VK>[] } | undefined {
  const rootVertex = graph.getVertex(rootId);
  if (!rootVertex) {
    return undefined;
  }

  const vertices: Vertex<V, VK>[] = [];
  const edges: Edge<E, EK, VK>[] = [];

  for (const { vertex, edge } of bfs(graph, rootId)) {
    vertices.push(vertex);
    if (edge) {
      edges.push(edge);
    }
  }

  return { vertices, edges };
}
