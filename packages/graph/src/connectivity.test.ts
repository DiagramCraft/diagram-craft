import { describe, expect, test } from 'vitest';
import { getConnectedComponent, getConnectedComponents } from './connectivity';
import { SimpleGraph } from './graph';

describe('Connectivity algorithms', () => {
  describe('getConnectedComponent', () => {
    test('returns single vertex component when vertex has no edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      expect(component!.vertices).toHaveLength(1);
      expect(component!.vertices[0]!.id).toBe('A');
      expect(component!.edges).toHaveLength(0);
    });

    test('returns all vertices in fully connected graph', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');

      const edgeIds = component!.edges.map(e => e.id);
      expect(edgeIds).toHaveLength(2);
      expect(edgeIds).toContain('AB');
      expect(edgeIds).toContain('BC');
    });

    test('treats edges as bidirectional', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      // Edge from A to B (directed)
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      // Edge from C to B (directed)
      graph.addEdge({ id: 'CB', from: 'C', to: 'B', weight: 1, data: undefined });

      // Starting from A should reach B and C (treating edges as bidirectional)
      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');
    });

    test('excludes disconnected vertices and edges', () => {
      const graph = new SimpleGraph();
      // Connected component 1: A-B
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      // Connected component 2: C-D
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      // Isolated vertex
      graph.addVertex({ id: 'E', data: undefined });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');
      expect(vertexIds).not.toContain('D');
      expect(vertexIds).not.toContain('E');

      const edgeIds = component!.edges.map(e => e.id);
      expect(edgeIds).toHaveLength(1);
      expect(edgeIds).toContain('AB');
      expect(edgeIds).not.toContain('CD');
    });

    test('handles cyclic graphs', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CA', from: 'C', to: 'A', weight: 1, data: undefined });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');

      const edgeIds = component!.edges.map(e => e.id);
      expect(edgeIds).toHaveLength(3);
    });

    test('ignores disabled edges', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      // Disabled edge from B to C
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, disabled: true, data: undefined });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(2);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).not.toContain('C');

      const edgeIds = component!.edges.map(e => e.id);
      expect(edgeIds).toHaveLength(1);
      expect(edgeIds).toContain('AB');
      expect(edgeIds).not.toContain('BC');
    });

    test('works with different starting vertices in same component', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      const componentFromA = getConnectedComponent(graph, 'A');
      const componentFromB = getConnectedComponent(graph, 'B');
      const componentFromC = getConnectedComponent(graph, 'C');

      // All should have the same vertices
      const verticesA = componentFromA!.vertices.map(v => v.id).sort();
      const verticesB = componentFromB!.vertices.map(v => v.id).sort();
      const verticesC = componentFromC!.vertices.map(v => v.id).sort();

      expect(verticesA).toEqual(['A', 'B', 'C']);
      expect(verticesB).toEqual(['A', 'B', 'C']);
      expect(verticesC).toEqual(['A', 'B', 'C']);
    });

    test('preserves vertex and edge data', () => {
      const graph = new SimpleGraph<string, number>();
      graph.addVertex({ id: 'A', data: 'vertex-a' });
      graph.addVertex({ id: 'B', data: 'vertex-b' });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 5, data: 42 });

      const component = getConnectedComponent(graph, 'A');

      expect(component).toBeDefined();
      const vertexA = component!.vertices.find(v => v.id === 'A');
      expect(vertexA?.data).toBe('vertex-a');

      const vertexB = component!.vertices.find(v => v.id === 'B');
      expect(vertexB?.data).toBe('vertex-b');

      const edge = component!.edges.find(e => e.id === 'AB');
      expect(edge?.data).toBe(42);
      expect(edge?.weight).toBe(5);
    });

    test('handles complex graph with multiple components', () => {
      const graph = new SimpleGraph();
      // Component 1: A-B-C (triangle)
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CA', from: 'C', to: 'A', weight: 1, data: undefined });

      // Component 2: D-E-F (line)
      graph.addVertex({ id: 'D', data: undefined });
      graph.addVertex({ id: 'E', data: undefined });
      graph.addVertex({ id: 'F', data: undefined });
      graph.addEdge({ id: 'DE', from: 'D', to: 'E', weight: 1, data: undefined });
      graph.addEdge({ id: 'EF', from: 'E', to: 'F', weight: 1, data: undefined });

      // Isolated vertices
      graph.addVertex({ id: 'G', data: undefined });
      graph.addVertex({ id: 'H', data: undefined });

      const component = getConnectedComponent(graph, 'B');

      expect(component).toBeDefined();
      const vertexIds = component!.vertices.map(v => v.id);
      expect(vertexIds).toHaveLength(3);
      expect(vertexIds).toContain('A');
      expect(vertexIds).toContain('B');
      expect(vertexIds).toContain('C');

      const edgeIds = component!.edges.map(e => e.id);
      expect(edgeIds).toHaveLength(3);
      expect(edgeIds).toContain('AB');
      expect(edgeIds).toContain('BC');
      expect(edgeIds).toContain('CA');
    });
  });

  describe('getConnectedComponents', () => {
    test('returns all components when no vertex filter provided', () => {
      const graph = new SimpleGraph();
      // Component 1: A-B
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      // Component 2: C-D
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      // Isolated vertex
      graph.addVertex({ id: 'E', data: undefined });

      const components = getConnectedComponents(graph);

      expect(components).toHaveLength(3);

      // Find components by checking vertex IDs
      const comp1 = components.find(c => c.vertices.some(v => v.id === 'A'));
      const comp2 = components.find(c => c.vertices.some(v => v.id === 'C'));
      const comp3 = components.find(c => c.vertices.some(v => v.id === 'E'));

      expect(comp1?.vertices.map(v => v.id).sort()).toEqual(['A', 'B']);
      expect(comp2?.vertices.map(v => v.id).sort()).toEqual(['C', 'D']);
      expect(comp3?.vertices.map(v => v.id)).toEqual(['E']);
    });

    test('returns only components containing specified vertices', () => {
      const graph = new SimpleGraph();
      // Component 1: A-B
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });

      // Component 2: C-D
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      // Component 3: E-F
      graph.addVertex({ id: 'E', data: undefined });
      graph.addVertex({ id: 'F', data: undefined });
      graph.addEdge({ id: 'EF', from: 'E', to: 'F', weight: 1, data: undefined });

      // Request only components containing B and D
      const components = getConnectedComponents(graph, new Set(['B', 'D']));

      expect(components).toHaveLength(2);

      const comp1 = components.find(c => c.vertices.some(v => v.id === 'A'));
      const comp2 = components.find(c => c.vertices.some(v => v.id === 'C'));

      expect(comp1?.vertices.map(v => v.id).sort()).toEqual(['A', 'B']);
      expect(comp2?.vertices.map(v => v.id).sort()).toEqual(['C', 'D']);
    });

    test('returns full components even when only one vertex is specified', () => {
      const graph = new SimpleGraph();
      // Large component: A-B-C-D
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      // Request component containing only B
      const components = getConnectedComponents(graph, new Set(['B']));

      expect(components).toHaveLength(1);
      expect(components[0]?.vertices.map(v => v.id).sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(components[0]?.edges).toHaveLength(3);
    });

    test('avoids duplicate components when multiple vertices from same component specified', () => {
      const graph = new SimpleGraph();
      // Single component: A-B-C
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      // Request with multiple vertices from the same component
      const components = getConnectedComponents(graph, new Set(['A', 'B', 'C']));

      // Should return only one component, not three
      expect(components).toHaveLength(1);
      expect(components[0]?.vertices.map(v => v.id).sort()).toEqual(['A', 'B', 'C']);
    });

    test('returns empty array when specified vertices do not exist', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      const components = getConnectedComponents(graph, new Set(['X', 'Y', 'Z']));

      expect(components).toHaveLength(0);
    });
  });
});
