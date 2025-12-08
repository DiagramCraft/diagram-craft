/**
 * Graph data structures.
 *
 * @example
 * ```ts
 * import { SimpleGraph } from '@diagram-craft/graph/graph';
 *
 * const graph = new SimpleGraph();
 * graph.addVertex({ id: 'A', data: {} });
 * graph.addVertex({ id: 'B', data: {} });
 * graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
 * ```
 *
 * @module
 */

import { MultiMap } from '@diagram-craft/utils/multimap';

export type VerticesAndEdges<V = unknown, E = unknown, VK = string, EK = string> = {
  vertices: Vertex<V, VK>[];
  edges: Edge<E, EK, VK>[];
};

/** A vertex in a graph with optional typed data */
export interface Vertex<T = unknown, K = string> {
  id: K;
  data: T;
}

/** An edge connecting two vertices with optional weight and typed data */
export interface Edge<T = unknown, K = string, VK = string> {
  id: K;
  from: VK;
  to: VK;
  weight: number;
  data: T;
  disabled?: boolean;
}

/** A graph containing vertices and edges with method-based access */
export interface Graph<V = unknown, E = unknown, VK = string, EK = string> {
  /** Get a vertex by its ID */
  getVertex(id: VK): Vertex<V, VK> | undefined;

  /** Get an edge by its ID */
  getEdge(id: EK): Edge<E, EK, VK> | undefined;

  /** Get an iterable of all vertices */
  vertices(): Iterable<Vertex<V, VK>>;

  /** Get an iterable of all edges */
  edges(): Iterable<Edge<E, EK, VK>>;

  adjacencyList(): MultiMap<
    VK,
    {
      vertexId: VK;
      edge: Edge<E, EK, VK>;
    }
  >;

  /**
   * Creates a new subgraph containing only the specified vertices and edges.
   * @param vertices Array of vertices to include in the subgraph
   * @param edges Array of edges to include in the subgraph
   * @returns A new SimpleGraph containing the specified vertices and edges
   */
  subgraph(
    vertices: Iterable<Vertex<V, VK>>,
    edges: Iterable<Edge<E, EK, VK>>
  ): Graph<V, E, VK, EK>;
}

/** A simple implementation of the Graph interface using Maps */
export class SimpleGraph<V = unknown, E = unknown, VK = string, EK = string> implements Graph<
  V,
  E,
  VK,
  EK
> {
  protected _vertices = new Map<VK, Vertex<V, VK>>();
  protected _edges = new Map<EK, Edge<E, EK, VK>>();
  protected _adjacencyList: MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }> | undefined =
    undefined;

  adjacencyList(): MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }> {
    if (this._adjacencyList) return this._adjacencyList;

    // Build adjacency list for efficient lookup
    this._adjacencyList = new MultiMap<VK, { vertexId: VK; edge: Edge<E, EK, VK> }>();
    for (const edge of this.edges()) {
      this._adjacencyList.add(edge.from, { vertexId: edge.to, edge });
    }

    return this._adjacencyList;
  }
  getVertex(id: VK): Vertex<V, VK> | undefined {
    return this._vertices.get(id);
  }

  getEdge(id: EK): Edge<E, EK, VK> | undefined {
    return this._edges.get(id);
  }

  vertices(): Iterable<Vertex<V, VK>> {
    return this._vertices.values();
  }

  edges(): Iterable<Edge<E, EK, VK>> {
    return this._edges.values();
  }

  /** Add a vertex to the graph */
  addVertex(vertex: Vertex<V, VK>): Vertex<V, VK> {
    this._vertices.set(vertex.id, vertex);
    return vertex;
  }

  /** Add an edge to the graph */
  addEdge(edge: Edge<E, EK, VK>): Edge<E, EK, VK> {
    this._edges.set(edge.id, edge);
    return edge;
  }

  removeEdge(edge: EK): boolean {
    return this._edges.delete(edge);
  }

  removeVertex(vertex: VK): boolean {
    return this._vertices.delete(vertex);
  }

  subgraph(
    vertices: Iterable<Vertex<V, VK>>,
    edges: Iterable<Edge<E, EK, VK>>
  ): SimpleGraph<V, E, VK, EK> {
    const subgraph = new SimpleGraph<V, E, VK, EK>();

    for (const vertex of vertices) {
      subgraph.addVertex(vertex);
    }

    for (const edge of edges) {
      subgraph.addEdge(edge);
    }

    return subgraph;
  }
}
