import type { Edge, Graph, Vertex, VerticesAndEdges } from './graph';
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
 *   - ancestors: Map from vertex ID to array of ancestors (ordered from immediate parent to root)
 *   Returns undefined if root doesn't exist
 */
export function extractMaximalTree<V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  rootId: VK
):
  | (VerticesAndEdges<V, E, VK, EK> & {
      children: MultiMap<VK, Vertex<V, VK>>;
      ancestors: Map<VK, Vertex<V, VK>[]>;
    })
  | undefined {
  const rootVertex = graph.getVertex(rootId);
  if (!rootVertex) {
    return undefined;
  }

  const vertices: Vertex<V, VK>[] = [];
  const edges: Edge<E, EK, VK>[] = [];
  const children = new MultiMap<VK, Vertex<V, VK>>();
  const ancestors = new Map<VK, Vertex<V, VK>[]>();

  for (const { vertex, edge } of bfs(graph, rootId)) {
    vertices.push(vertex);

    if (edge) {
      edges.push(edge);

      // Determine effective parent and child based on which vertex was already visited
      // Since BFS is bidirectional, edge.from might not be the actual parent
      const parentId = vertex.id === edge.from ? edge.to : edge.from;
      const childId = parentId === edge.from ? edge.to : edge.from;

      // Add to children map
      const childVertex = graph.getVertex(childId);
      if (childVertex) {
        children.add(parentId, childVertex);

        // Build ancestors path by copying parent's ancestors and adding parent
        const parentVertex = graph.getVertex(parentId);
        if (parentVertex) {
          const parentAncestors = ancestors.get(parentId) ?? [];
          ancestors.set(childId, [parentVertex, ...parentAncestors]);
        }
      }
    } else {
      // Root vertex has no ancestors
      ancestors.set(vertex.id, []);
    }
  }

  return { vertices, edges, children, ancestors };
}
