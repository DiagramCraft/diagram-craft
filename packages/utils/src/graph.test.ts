import { describe, expect, test } from 'vitest';
import {
  type EdgePenaltyFunction,
  findShortestPathAStar,
  type HeuristicFunction,
  SimpleGraph
} from './graph';

describe('Graph utilities', () => {
  describe('findShortestPathAStar', () => {
    // Simple heuristic that returns 0 (essentially makes A* behave like Dijkstra)
    const zeroHeuristic: HeuristicFunction = () => 0;

    // Manhattan distance heuristic for grid-based tests
    const manhattanHeuristic: HeuristicFunction<{ x: number; y: number }> = (from, to) => {
      return Math.abs(from.data.x - to.data.x) + Math.abs(from.data.y - to.data.y);
    };

    test('finds path in simple graph with zero heuristic', () => {
      // Setup - Same as Dijkstra test but using A*
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 2, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 5, data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'C', zeroHeuristic);

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(3);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'C']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BC']);
    });

    test('finds direct path when shorter with zero heuristic', () => {
      // Setup
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 2, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 2, data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'C', zeroHeuristic);

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(2);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'C']);
      expect(result!.edges.map(e => e.id)).toEqual(['AC']);
    });

    test('uses Manhattan heuristic effectively in grid', () => {
      // Setup - 3x3 grid where A* should outperform Dijkstra
      const graph = new SimpleGraph<{ x: number; y: number }>();

      // Create 3x3 grid of vertices
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          const id = `${x},${y}`;
          graph.addVertex({ id, data: { x, y } });
        }
      }

      // Add edges between adjacent cells (4-connected)
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          const id = `${x},${y}`;
          // Right edge
          if (x < 2) {
            const rightId = `${x + 1},${y}`;
            graph.addEdge({
              id: `${id}-${rightId}`,
              from: id,
              to: rightId,
              weight: 1,
              data: undefined
            });
          }
          // Down edge
          if (y < 2) {
            const downId = `${x},${y + 1}`;
            graph.addEdge({
              id: `${id}-${downId}`,
              from: id,
              to: downId,
              weight: 1,
              data: undefined
            });
          }
          // Left edge (for bidirectional)
          if (x > 0) {
            const leftId = `${x - 1},${y}`;
            graph.addEdge({
              id: `${id}-${leftId}`,
              from: id,
              to: leftId,
              weight: 1,
              data: undefined
            });
          }
          // Up edge (for bidirectional)
          if (y > 0) {
            const upId = `${x},${y - 1}`;
            graph.addEdge({
              id: `${id}-${upId}`,
              from: id,
              to: upId,
              weight: 1,
              data: undefined
            });
          }
        }
      }

      // Act - Find path from top-left to bottom-right
      const result = findShortestPathAStar(graph, '0,0', '2,2', manhattanHeuristic);

      // Verify - Should find optimal path
      expect(result).toBeDefined();
      expect(result!.distance).toBe(4); // Manhattan distance in grid
      expect(result!.path).toHaveLength(5); // 5 vertices in path
      expect(result!.path[0].id).toBe('0,0');
      expect(result!.path[result!.path.length - 1].id).toBe('2,2');
    });

    test('returns undefined for non-existent vertices', () => {
      // Setup
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });

      // Act & Verify
      expect(findShortestPathAStar(graph, 'X', 'A', zeroHeuristic)).toBeUndefined();
      expect(findShortestPathAStar(graph, 'A', 'X', zeroHeuristic)).toBeUndefined();
    });

    test('returns undefined when no path exists', () => {
      // Setup - Two disconnected vertices
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'B', zeroHeuristic);

      // Verify
      expect(result).toBeUndefined();
    });

    test('handles same start and end vertex', () => {
      // Setup
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'A', zeroHeuristic);

      // Verify
      expect(result).toBeDefined();
      expect(result!.distance).toBe(0);
      expect(result!.path.map(v => v.id)).toEqual(['A']);
      expect(result!.edges).toEqual([]);
    });

    test('ignores disabled edges', () => {
      // Setup - Direct path is disabled, forcing use of longer path
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 1, disabled: true, data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 2, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 2, data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'C', zeroHeuristic);

      // Verify - Should use A->B->C path since A->C is disabled
      expect(result).toBeDefined();
      expect(result!.distance).toBe(4);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'C']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BC']);
    });

    test('works with penalty function', () => {
      // Setup
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 5, data: undefined });
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });

      // Penalty function that adds 10 to any edge from B (no previousEdge parameter)
      const penaltyFunction: EdgePenaltyFunction = (_, currentVertex) => {
        return currentVertex!.id === 'B' ? 10 : 0;
      };

      // Act
      const result = findShortestPathAStar(graph, 'A', 'C', zeroHeuristic, penaltyFunction);

      // Verify - Direct path chosen due to penalty
      expect(result).toBeDefined();
      expect(result!.distance).toBe(5);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'C']);
    });

    test('penalty function is path-independent (no previousEdge)', () => {
      // Setup - Test that penalty function doesn't get previousEdge parameter
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: undefined });
      graph.addVertex({ id: 'B', data: undefined });
      graph.addVertex({ id: 'C', data: undefined });
      graph.addVertex({ id: 'D', data: undefined });

      // Create paths: A->B->D (weight 1+1) and A->C->D (weight 1+5)
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BD', from: 'B', to: 'D', weight: 1, data: undefined });
      graph.addEdge({ id: 'AC', from: 'A', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 5, data: undefined });

      // Penalty function that penalizes edges based on their destination only
      const penaltyFunction: EdgePenaltyFunction = (
        _previousEdge,
        _currentVertex,
        proposedEdge
      ) => {
        // Add penalty to edges going to D from C (but not from B)
        return proposedEdge.to === 'D' && proposedEdge.from === 'C' ? 10 : 0;
      };

      // Act
      const result = findShortestPathAStar(graph, 'A', 'D', zeroHeuristic, penaltyFunction);

      // Verify - Should choose A->B->D path due to penalty on C->D
      expect(result).toBeDefined();
      expect(result!.distance).toBe(2); // 1 + 1, no penalty on this path
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'D']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BD']);
    });

    test('heuristic guides search efficiently', () => {
      // Setup - Create a graph where good heuristic should find path faster
      const graph = new SimpleGraph<{ x: number; y: number }>();

      // Create vertices in a line: A(0,0) -> B(1,0) -> C(2,0) -> D(3,0)
      // And detour: A -> E(0,1) -> F(0,2) -> G(1,2) -> H(2,2) -> D
      const vertices = [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 1, y: 0 },
        { id: 'C', x: 2, y: 0 },
        { id: 'D', x: 3, y: 0 },
        { id: 'E', x: 0, y: 1 },
        { id: 'F', x: 0, y: 2 },
        { id: 'G', x: 1, y: 2 },
        { id: 'H', x: 2, y: 2 }
      ];

      vertices.forEach(v => {
        graph.addVertex({ id: v.id, data: { x: v.x, y: v.y } });
      });

      // Direct path (weight 1 each)
      graph.addEdge({ id: 'AB', from: 'A', to: 'B', weight: 1, data: undefined });
      graph.addEdge({ id: 'BC', from: 'B', to: 'C', weight: 1, data: undefined });
      graph.addEdge({ id: 'CD', from: 'C', to: 'D', weight: 1, data: undefined });

      // Detour path (weight 1 each, but longer)
      graph.addEdge({ id: 'AE', from: 'A', to: 'E', weight: 1, data: undefined });
      graph.addEdge({ id: 'EF', from: 'E', to: 'F', weight: 1, data: undefined });
      graph.addEdge({ id: 'FG', from: 'F', to: 'G', weight: 1, data: undefined });
      graph.addEdge({ id: 'GH', from: 'G', to: 'H', weight: 1, data: undefined });
      graph.addEdge({ id: 'HD', from: 'H', to: 'D', weight: 1, data: undefined });

      // Act
      const result = findShortestPathAStar(graph, 'A', 'D', manhattanHeuristic);

      // Verify - Should choose direct path
      expect(result).toBeDefined();
      expect(result!.distance).toBe(3);
      expect(result!.path.map(v => v.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(result!.edges.map(e => e.id)).toEqual(['AB', 'BC', 'CD']);
    });
  });
});
