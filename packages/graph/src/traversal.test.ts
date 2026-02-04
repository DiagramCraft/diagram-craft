import { describe, expect, test } from 'vitest';
import { dfs, bfs } from './traversal';
import { SimpleGraph } from './graph';

describe('Graph traversal algorithms', () => {
  describe('dfs', () => {
    test('yields single vertex when starting from isolated vertex', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      const results = Array.from(dfs(graph, 'A'));

      expect(results).toHaveLength(1);
      expect(results[0]!.vertex.id).toBe('A');
      expect(results[0]!.edge).toBeUndefined();
    });

    test('traverses all connected vertices in simple graph', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
    });

    test('treats edges as bidirectional by default', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      // Directed edge from A to B
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      // Directed edge from C to B
      graph.addEdge({ id: 'CB', from: 'C', to: 'B', weight: 1, data: undefined });

      // Starting from A should reach B and C (bidirectional)
      const results = Array.from(dfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
    });

    test('respects directionality when option is set', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      // A -> B (can traverse from A to B)
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      // C -> B (cannot traverse from A to C)
      graph.addEdge({ id: 'CB', from: 'C', to: 'B', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A', { respectDirectionality: true }));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
    });

    test('ignores disabled edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, disabled: true, data: undefined });

      const results = Array.from(dfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
    });

    test('handles cyclic graphs without infinite loop', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CA', from: 'C', to: 'A', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
    });

    test('stops at disconnected components', () => {
      const graph = new SimpleGraph();
      // Component 1: A-B
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      // Component 2: C-D
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
      expect(vertexIds).not.toContain('D');
    });

    test('yields vertices in order starting with start vertex', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A'));

      // First vertex should always be the start vertex
      expect(results[0]!.vertex.id).toBe('A');
    });

    test('handles empty graph gracefully', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });

      const results = Array.from(dfs(graph, 'A'));

      expect(results).toHaveLength(1);
      expect(results[0]!.vertex.id).toBe('A');
    });

    test('works with different starting vertices in same component', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const fromA = Array.from(dfs(graph, 'A')).map(r => r.vertex.id).sort();
      const fromB = Array.from(dfs(graph, 'B')).map(r => r.vertex.id).sort();
      const fromC = Array.from(dfs(graph, 'C')).map(r => r.vertex.id).sort();

      expect(fromA).toEqual(['A', 'B', 'C']);
      expect(fromB).toEqual(['A', 'B', 'C']);
      expect(fromC).toEqual(['A', 'B', 'C']);
    });

    test('preserves vertex data during traversal', () => {
      const graph = new SimpleGraph<string>();
      graph.addVertex({ id: 'A', data: 'vertex-a' });
      graph.addVertex({ id: 'B', data: 'vertex-b' });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      const results = Array.from(dfs(graph, 'A'));

      expect(results[0]!.vertex.data).toBe('vertex-a');
      expect(results[1]!.vertex.data).toBe('vertex-b');
    });
  });

  describe('bfs', () => {
    test('yields single vertex with no edge for isolated vertex', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });

      const results = Array.from(bfs(graph, 'A'));

      expect(results).toHaveLength(1);
      expect(results[0]!.vertex.id).toBe('A');
      expect(results[0]!.edge).toBeUndefined();
    });

    test('yields vertices and edges in BFS order', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const results = Array.from(bfs(graph, 'A'));

      expect(results).toHaveLength(3);
      expect(results[0]!.vertex.id).toBe('A');
      expect(results[0]!.edge).toBeUndefined();
      expect(results[1]!.vertex.id).toBe('B');
      expect(results[1]!.edge?.id).toBe('AB');
      expect(results[2]!.vertex.id).toBe('C');
      expect(results[2]!.edge?.id).toBe('BC');
    });

    test('creates spanning tree without duplicate edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });

      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'BD', from: 'B', to: 'D', weight: 1, data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined }); // Creates cycle

      const results = Array.from(bfs(graph, 'A'));
      const edges = results.filter(r => r.edge !== undefined).map(r => r.edge!.id);

      expect(results).toHaveLength(4); // 4 vertices
      expect(edges).toHaveLength(3); // Only 3 edges for tree
      expect(new Set(edges).size).toBe(3); // No duplicate edges
    });

    test('treats edges as bidirectional by default', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'CB', from: 'C', to: 'B', weight: 1, data: undefined });

      const results = Array.from(bfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
    });

    test('respects directionality when option is set', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'CB', from: 'C', to: 'B', weight: 1, data: undefined });

      const results = Array.from(bfs(graph, 'A', { respectDirectionality: true }));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
    });

    test('ignores disabled edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, disabled: true, data: undefined });

      const results = Array.from(bfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
    });

    test('stops at disconnected components', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      const results = Array.from(bfs(graph, 'A'));
      const vertexIds = results.map(r => r.vertex.id);

      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
      expect(vertexIds).not.toContain('D');
    });

    test('preserves vertex and edge data during traversal', () => {
      const graph = new SimpleGraph<string, string>();
      graph.addVertex({ id: 'A', data: 'vertex-a' });
      graph.addVertex({ id: 'B', data: 'vertex-b' });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: 'edge-ab' });

      const results = Array.from(bfs(graph, 'A'));

      expect(results[0]!.vertex.data).toBe('vertex-a');
      expect(results[1]!.vertex.data).toBe('vertex-b');
      expect(results[1]!.edge?.data).toBe('edge-ab');
    });

    test('root vertex always has undefined edge', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const results = Array.from(bfs(graph, 'B'));

      expect(results[0]!.vertex.id).toBe('B');
      expect(results[0]!.edge).toBeUndefined();
    });
  });
});
