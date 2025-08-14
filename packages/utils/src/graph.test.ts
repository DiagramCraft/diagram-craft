import { describe, expect, test } from 'vitest';
import { type EdgePenaltyFunction, findShortestPath, type Graph } from './graph';

describe('Graph utilities', () => {
  describe('findShortestPath', () => {
    test('finds path in simple graph', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.vertices.set('C', { id: 'C' });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 1 });
      graph.edges.set('BC', { id: 'BC', from: 'B', to: 'C', weight: 2 });
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 5 });

      // Act
      const result = findShortestPath(graph, 'A', 'C');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(3);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'C']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BC']);
    });

    test('finds direct path when shorter', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.vertices.set('C', { id: 'C' });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 1 });
      graph.edges.set('BC', { id: 'BC', from: 'B', to: 'C', weight: 2 });
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 2 });

      // Act
      const result = findShortestPath(graph, 'A', 'C');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(2);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'C']);
      expect(result!.edges.map(e => e.id)).toEqual(['AC']);
    });

    test('handles unweighted edges (default weight 1)', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B' });

      // Act
      const result = findShortestPath(graph, 'A', 'B');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(1);
    });

    test('returns undefined for non-existent start vertex', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });

      // Act
      const result = findShortestPath(graph, 'X', 'A');

      // Verify
      expect(result).toBeUndefined();
    });

    test('returns undefined for non-existent end vertex', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });

      // Act
      const result = findShortestPath(graph, 'A', 'X');

      // Verify
      expect(result).toBeUndefined();
    });

    test('returns undefined when no path exists', () => {
      // Setup - No edges connecting A to B
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });

      // Act
      const result = findShortestPath(graph, 'A', 'B');

      // Verify
      expect(result).toBeUndefined();
    });

    test('finds path in complex graph', () => {
      // Setup - Create a more complex graph
      const graph = { vertices: new Map(), edges: new Map() };
      ['A', 'B', 'C', 'D', 'E'].forEach(id => graph.vertices.set(id, { id }));
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 2 });
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 4 });
      graph.edges.set('BD', { id: 'BD', from: 'B', to: 'D', weight: 1 });
      graph.edges.set('BE', { id: 'BE', from: 'B', to: 'E', weight: 3 });
      graph.edges.set('CD', { id: 'CD', from: 'C', to: 'D', weight: 5 });
      graph.edges.set('DE', { id: 'DE', from: 'D', to: 'E', weight: 1 });

      // Act
      const result = findShortestPath(graph, 'A', 'E');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(4);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'D', 'E']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BD', 'DE']);
    });

    test('handles same start and end vertex', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });

      // Act
      const result = findShortestPath(graph, 'A', 'A');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(0);
      expect(result!.path.map(v => v.id)).toEqual(['A']);
      expect(result!.edges).toEqual([]);
    });

    test('works with typed vertices and edges', () => {
      // Setup
      interface NodeData {
        name: string;
      }
      interface EdgeData {
        type: string;
      }
      const graph: Graph<NodeData, EdgeData> = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A', data: { name: 'Start' } });
      graph.vertices.set('B', { id: 'B', data: { name: 'End' } });
      graph.edges.set('AB', {
        id: 'AB',
        from: 'A',
        to: 'B',
        weight: 1,
        data: { type: 'connection' }
      });

      // Act
      const result = findShortestPath(graph, 'A', 'B');

      // Verify
      expect(result).toBeDefined();
      expect(result!.path[0].data?.name).toBe('Start');
      expect(result!.path[1].data?.name).toBe('End');
      expect(result!.edges[0].data?.type).toBe('connection');
    });

    test('handles zero weight edges', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.vertices.set('C', { id: 'C' });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 0 });
      graph.edges.set('BC', { id: 'BC', from: 'B', to: 'C', weight: 1 });
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 2 });

      // Act
      const result = findShortestPath(graph, 'A', 'C');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(1);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'C']);
    });

    test('uses penalty function to adjust edge weights', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.vertices.set('C', { id: 'C' });
      // Direct path has weight 5, indirect path has weight 1+1=2
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 5 });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 1 });
      graph.edges.set('BC', { id: 'BC', from: 'B', to: 'C', weight: 1 });
      // Penalty function that adds 10 to any edge from B
      const penaltyFunction: EdgePenaltyFunction = (_prevEdge, currentVertex, _proposedEdge) => {
        return currentVertex.id === 'B' ? 10 : 0;
      };

      // Act
      const result = findShortestPath(graph, 'A', 'C', penaltyFunction);

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(5); // Direct path chosen due to penalty
      expect(result!.path.map(v => v.id)).toEqual(['A', 'C']);
    });

    test('penalty function receives correct parameters', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A', data: { name: 'start' } });
      graph.vertices.set('B', { id: 'B', data: { name: 'middle' } });
      graph.vertices.set('C', { id: 'C', data: { name: 'end' } });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 1, data: { type: 'first' } });
      graph.edges.set('BC', { id: 'BC', from: 'B', to: 'C', weight: 1, data: { type: 'second' } });
      const penaltyCallLog: Array<{ prevEdge: any; currentVertex: any; proposedEdge: any }> = [];
      const penaltyFunction: EdgePenaltyFunction = (prevEdge, currentVertex, proposedEdge) => {
        penaltyCallLog.push({ prevEdge, currentVertex, proposedEdge });
        return 0; // No penalty
      };

      // Act
      findShortestPath(graph, 'A', 'C', penaltyFunction);

      // Verify
      expect(penaltyCallLog).toHaveLength(2);
      // First call: from A, no previous edge
      expect(penaltyCallLog[0].prevEdge).toBeUndefined();
      expect(penaltyCallLog[0].currentVertex.id).toBe('A');
      expect(penaltyCallLog[0].proposedEdge.id).toBe('AB');
      // Second call: from B, previous edge was AB
      expect(penaltyCallLog[1].prevEdge?.id).toBe('AB');
      expect(penaltyCallLog[1].currentVertex.id).toBe('B');
      expect(penaltyCallLog[1].proposedEdge.id).toBe('BC');
    });

    test('penalty function can encourage specific paths', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      ['A', 'B', 'C', 'D'].forEach(id => graph.vertices.set(id, { id }));
      // Two paths: A->B->D (weight 2+2=4) and A->C->D (weight 3+3=6)
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 2 });
      graph.edges.set('BD', { id: 'BD', from: 'B', to: 'D', weight: 2 });
      graph.edges.set('AC', { id: 'AC', from: 'A', to: 'C', weight: 3 });
      graph.edges.set('CD', { id: 'CD', from: 'C', to: 'D', weight: 3 });
      // Penalty function that discourages going through B
      const penaltyFunction: EdgePenaltyFunction = (_prevEdge, currentVertex, _proposedEdge) => {
        return currentVertex.id === 'B' ? 5 : 0; // Add penalty when leaving B
      };

      // Act
      const result = findShortestPath(graph, 'A', 'D', penaltyFunction);

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(6); // A->C->D path chosen despite higher base weight
      expect(result!.path.map(v => v.id)).toEqual(['A', 'C', 'D']);
    });

    test('works without penalty function (backward compatibility)', () => {
      // Setup
      const graph = { vertices: new Map(), edges: new Map() };
      graph.vertices.set('A', { id: 'A' });
      graph.vertices.set('B', { id: 'B' });
      graph.edges.set('AB', { id: 'AB', from: 'A', to: 'B', weight: 1 });

      // Act
      const result = findShortestPath(graph, 'A', 'B');

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(1);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B']);
    });
  });
});
