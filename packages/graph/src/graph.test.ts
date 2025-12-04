import { describe, expect, test } from 'vitest';
import { SimpleGraph } from './graph';

describe('Graph data structures', () => {
  describe('SimpleGraph', () => {
    test('adds and retrieves vertices', () => {
      const graph = new SimpleGraph<string>();
      const vertexA = graph.addVertex({ id: 'A', data: 'vertex-a' });
      const vertexB = graph.addVertex({ id: 'B', data: 'vertex-b' });

      expect(graph.getVertex('A')).toBe(vertexA);
      expect(graph.getVertex('B')).toBe(vertexB);
      expect(graph.getVertex('C')).toBeUndefined();
    });

    test('adds and retrieves edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      const edge = graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      expect(graph.getEdge('AB')).toBe(edge);
      expect(graph.getEdge('XY')).toBeUndefined();
    });

    test('removes vertices', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      expect(graph.removeVertex('A')).toBe(true);
      expect(graph.getVertex('A')).toBeUndefined();
      expect(graph.removeVertex('A')).toBe(false);
    });

    test('removes edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      expect(graph.removeEdge('AB')).toBe(true);
      expect(graph.getEdge('AB')).toBeUndefined();
      expect(graph.removeEdge('AB')).toBe(false);
    });

    test('iterates over vertices', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });

      const vertexIds = Array.from(graph.vertices()).map(v => v.id);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
      expect(vertexIds).toHaveLength(3);
    });

    test('iterates over edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 2, data: undefined });

      const edgeIds = Array.from(graph.edges()).map(e => e.id);
      expect(edgeIds).toContain('AB');
      expect(edgeIds).toContain('BC');
      expect(edgeIds).toHaveLength(2);
    });

    test('builds adjacency list', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 2, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 3, data: undefined });

      const adjacencyList = graph.adjacencyList();

      const neighborsA = adjacencyList.get('A');
      expect(neighborsA).toHaveLength(2);
      expect(neighborsA.map(n => n.vertexId)).toContain('B');
      expect(neighborsA.map(n => n.vertexId)).toContain('C');

      const neighborsB = adjacencyList.get('B');
      expect(neighborsB).toHaveLength(1);
      expect(neighborsB[0]!.vertexId).toBe('C');

      const neighborsC = adjacencyList.get('C');
      expect(neighborsC).toHaveLength(0);
    });

    test('caches adjacency list', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      const adjacencyList1 = graph.adjacencyList();
      const adjacencyList2 = graph.adjacencyList();

      expect(adjacencyList1).toBe(adjacencyList2);
    });

    test('creates subgraph with specified vertices and edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 2, data: undefined });

      const vertexA = graph.getVertex('A')!;
      const vertexB = graph.getVertex('B')!;
      const edgeAB = graph.getEdge('AB')!;

      const subgraph = graph.subgraph([vertexA, vertexB], [edgeAB]);

      expect(Array.from(subgraph.vertices()).map(v => v.id)).toEqual(['A', 'B']);
      expect(Array.from(subgraph.edges()).map(e => e.id)).toEqual(['AB']);
      expect(subgraph.getVertex('C')).toBeUndefined();
      expect(subgraph.getEdge('BC')).toBeUndefined();
    });

    test('creates empty subgraph from empty arrays', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });

      const subgraph = graph.subgraph([], []);

      expect(Array.from(subgraph.vertices())).toHaveLength(0);
      expect(Array.from(subgraph.edges())).toHaveLength(0);
    });

    test('createSubgraph preserves vertex and edge data', () => {
      const graph = new SimpleGraph<string, number>();
      graph.addVertex({ id: 'A', data: 'vertex-a' });
      graph.addVertex({ id: 'B', data: 'vertex-b' });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 5, data: 42 });

      const vertices = Array.from(graph.vertices());
      const edges = Array.from(graph.edges());
      const subgraph = graph.subgraph(vertices, edges);

      const vertexA = subgraph.getVertex('A');
      expect(vertexA?.data).toBe('vertex-a');

      const edge = subgraph.getEdge('AB');
      expect(edge?.data).toBe(42);
      expect(edge?.weight).toBe(5);
    });

    test('createSubgraph returns independent graph', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      const vertices = Array.from(graph.vertices());
      const edges = Array.from(graph.edges());
      const subgraph = graph.subgraph(vertices, edges);

      // Add vertex to subgraph
      subgraph.addVertex({ id: 'C', data: undefined });

      // Original graph should not be affected
      expect(graph.getVertex('C')).toBeUndefined();
      expect(subgraph.getVertex('C')).toBeDefined();
    });
  });
});
