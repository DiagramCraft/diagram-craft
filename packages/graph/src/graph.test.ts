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
  });
});
