import type { Edge, Graph, Vertex } from './graph';
import { bfs } from './traversal';
import { MultiMap } from '@diagram-craft/utils/multimap';

/**
 * Extracts the largest tree subgraph rooted at the given vertex.
 *
 * Uses BFS traversal to build a tree by visiting vertices and including edges
 * to unvisited neighbors. This ensures no cycles are included, maintaining
 * the tree property.
 *
 * @param graph - The graph to extract the tree from
 * @param rootId - The ID of the vertex to use as the root
 * @returns An object containing:
 *   - vertices: Array of vertices in the tree
 *   - edges: Array of edges in the tree
 *   - children: MultiMap from parent vertex ID to child vertices
 *   - ancestors: MultiMap from vertex ID to all ancestors (path to root)
 *   Returns undefined if root doesn't exist
 */
export function extractMaximalTree<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  rootId: VK
): {
  vertices: Vertex<V, VK>[];
  edges: Edge<E, EK, VK>[];
  children: MultiMap<VK, Vertex<V, VK>>;
  ancestors: MultiMap<VK, Vertex<V, VK>>;
} | undefined {
  const rootVertex = graph.getVertex(rootId);
  if (!rootVertex) {
    return undefined;
  }

  const vertices: Vertex<V, VK>[] = [];
  const edges: Edge<E, EK, VK>[] = [];
  const children = new MultiMap<VK, Vertex<V, VK>>();
  const ancestors = new MultiMap<VK, Vertex<V, VK>>();

  // Map to track parent of each vertex
  const parentMap = new Map<VK, VK>();

  for (const { vertex, edge } of bfs(graph, rootId)) {
    vertices.push(vertex);

    if (edge) {
      edges.push(edge);
      // Track parent relationship
      parentMap.set(edge.to, edge.from);

      // Add to children map
      const childVertex = graph.getVertex(edge.to);
      if (childVertex) {
        children.add(edge.from, childVertex);
      }
    }
  }

  // Build ancestors map by walking up the parent chain for each vertex
  for (const vertex of vertices) {
    let currentId: VK | undefined = parentMap.get(vertex.id);

    while (currentId !== undefined) {
      const ancestorVertex = graph.getVertex(currentId);
      if (ancestorVertex) {
        ancestors.add(vertex.id, ancestorVertex);
      }
      currentId = parentMap.get(currentId);
    }
  }

  return { vertices, edges, children, ancestors };
}
