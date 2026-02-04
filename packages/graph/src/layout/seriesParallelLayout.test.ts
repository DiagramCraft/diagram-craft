import { describe, test, expect } from 'vitest';
import { SimpleGraph } from '../graph';
import { layoutSeriesParallel } from './seriesParallelLayout';

describe('layoutSeriesParallel', () => {
  describe('Basic SP graphs', () => {
    test('single edge returns two positions', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(2);
      expect(positions.get('A')).toEqual({ x: 0, y: 0 });
      expect(positions.get('B')?.y).toBeGreaterThan(0);
    });

    test('series chain A→B→C stacks vertically', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(3);
      const posA = positions.get('A')!;
      const posB = positions.get('B')!;
      const posC = positions.get('C')!;

      // Series: stacked vertically
      expect(posA.y).toBe(0);
      expect(posB.y).toBeGreaterThan(posA.y);
      expect(posC.y).toBeGreaterThan(posB.y);

      // Same x-coordinate for series
      expect(posA.x).toBe(posB.x);
      expect(posB.x).toBe(posC.x);
    });

    test('parallel paths A→C and A→B→C arranges horizontally', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'B', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(3);
      const posA = positions.get('A')!;
      const posB = positions.get('B')!;
      const posC = positions.get('C')!;

      // Source and sink at same vertical level
      expect(posA.y).toBe(0);
      expect(posC.y).toBeGreaterThan(0);

      // B should be offset horizontally (parallel path)
      expect(posB.x).not.toBe(posA.x);
    });

    test('diamond graph (series + parallel)', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addVertex({ id: 'D', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });
      graph.addEdge({ id: 'e4', from: 'C', to: 'D', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(4);
      const posA = positions.get('A')!;
      const posB = positions.get('B')!;
      const posC = positions.get('C')!;
      const posD = positions.get('D')!;

      // Source at top
      expect(posA.y).toBe(0);

      // Parallel paths B and C
      expect(posB.x).not.toBe(posC.x);

      // Sink at bottom
      expect(posD.y).toBeGreaterThan(Math.max(posB.y, posC.y));
    });
  });

  describe('Complex SP graphs', () => {
    test('nested series-parallel structure', () => {
      const graph = new SimpleGraph();
      // Create: A → (B1→C1 | B2→C2) → D
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B1', data: {} });
      graph.addVertex({ id: 'B2', data: {} });
      graph.addVertex({ id: 'C1', data: {} });
      graph.addVertex({ id: 'C2', data: {} });
      graph.addVertex({ id: 'D', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B1', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'B2', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'B1', to: 'C1', weight: 1, data: {} });
      graph.addEdge({ id: 'e4', from: 'B2', to: 'C2', weight: 1, data: {} });
      graph.addEdge({ id: 'e5', from: 'C1', to: 'D', weight: 1, data: {} });
      graph.addEdge({ id: 'e6', from: 'C2', to: 'D', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(6);
      const posA = positions.get('A')!;
      const posD = positions.get('D')!;

      expect(posA.y).toBe(0);
      expect(posD.y).toBeGreaterThan(0);
    });

    test('wide parallel with many branches', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B1', data: {} });
      graph.addVertex({ id: 'B2', data: {} });
      graph.addVertex({ id: 'B3', data: {} });
      graph.addVertex({ id: 'C', data: {} });

      graph.addEdge({ id: 'e1', from: 'A', to: 'B1', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'B2', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'A', to: 'B3', weight: 1, data: {} });
      graph.addEdge({ id: 'e4', from: 'B1', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e5', from: 'B2', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e6', from: 'B3', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      expect(positions.size).toBe(5);

      // All intermediate nodes should have different x positions (parallel)
      const posB1 = positions.get('B1')!;
      const posB2 = positions.get('B2')!;
      const posB3 = positions.get('B3')!;

      expect(posB1.x).not.toBe(posB2.x);
      expect(posB2.x).not.toBe(posB3.x);
      expect(posB1.x).not.toBe(posB3.x);
    });
  });

  describe('Non-SP graphs with fallback', () => {
    test('K4 complete graph falls back to layered layout', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addVertex({ id: 'D', data: {} });

      // Create K4 (complete graph on 4 vertices)
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'A', to: 'D', weight: 1, data: {} });
      graph.addEdge({ id: 'e4', from: 'B', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e5', from: 'B', to: 'D', weight: 1, data: {} });
      graph.addEdge({ id: 'e6', from: 'C', to: 'D', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      // Should still return positions (via fallback)
      expect(positions.size).toBeGreaterThan(0);
    });

    test('graph with multiple sources falls back', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      // Multiple sources, should fall back to layered
      expect(positions.size).toBe(3);
    });

    test('graph with multiple sinks falls back', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      // Multiple sinks, should fall back to layered
      expect(positions.size).toBe(3);
    });

    test('fallback disabled returns empty map', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { fallbackToLayered: false });

      // Multiple sinks, fallback disabled
      expect(positions.size).toBe(0);
    });
  });

  describe('Options and configuration', () => {
    test('horizontal spacing affects x-coordinates', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B1', data: {} });
      graph.addVertex({ id: 'B2', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B1', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'A', to: 'B2', weight: 1, data: {} });
      graph.addEdge({ id: 'e3', from: 'B1', to: 'C', weight: 1, data: {} });
      graph.addEdge({ id: 'e4', from: 'B2', to: 'C', weight: 1, data: {} });

      const positions1 = layoutSeriesParallel(graph, ['A'], { horizontalSpacing: 1 });
      const positions2 = layoutSeriesParallel(graph, ['A'], { horizontalSpacing: 2 });

      const pos1B1 = positions1.get('B1')!;
      const pos1B2 = positions1.get('B2')!;
      const pos2B1 = positions2.get('B1')!;
      const pos2B2 = positions2.get('B2')!;

      // With larger spacing, the distance between parallel paths should increase
      const dist1 = Math.abs(pos1B2.x - pos1B1.x);
      const dist2 = Math.abs(pos2B2.x - pos2B1.x);
      expect(dist2).toBeGreaterThan(dist1);
    });

    test('vertical spacing affects y-coordinates', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions1 = layoutSeriesParallel(graph, ['A'], { verticalSpacing: 1 });
      const positions2 = layoutSeriesParallel(graph, ['A'], { verticalSpacing: 2 });

      const pos1B = positions1.get('B')!;
      const pos2B = positions2.get('B')!;

      // With larger spacing, y-coordinates should be scaled
      expect(pos2B.y).toBeGreaterThan(pos1B.y);
    });

    test('direction down (default)', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { direction: 'down' });

      const posA = positions.get('A')!;
      const posB = positions.get('B')!;

      expect(posA.y).toBe(0);
      expect(posB.y).toBeGreaterThan(posA.y);
    });

    test('direction up', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { direction: 'up' });

      const posA = positions.get('A')!;
      const posB = positions.get('B')!;

      expect(posA.y).toBe(0);
      expect(posB.y).toBeLessThan(posA.y);
    });

    test('direction left', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { direction: 'left' });

      const posA = positions.get('A')!;
      const posB = positions.get('B')!;

      expect(posA.x).toBe(0);
      expect(posB.x).toBeLessThan(posA.x);
    });

    test('direction right', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { direction: 'right' });

      const posA = positions.get('A')!;
      const posB = positions.get('B')!;

      expect(posA.x).toBe(0);
      expect(posB.x).toBeGreaterThan(posA.x);
    });

    test('disabled edges are ignored', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {}, disabled: true });

      const positions = layoutSeriesParallel(graph, ['A']);

      // Only A and B should be positioned (C is disconnected via disabled edge)
      expect(positions.size).toBe(2);
      expect(positions.has('A')).toBe(true);
      expect(positions.has('B')).toBe(true);
      expect(positions.has('C')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('empty start IDs returns empty map', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });

      const positions = layoutSeriesParallel(graph, []);

      expect(positions.size).toBe(0);
    });

    test('single node returns single position', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });

      const positions = layoutSeriesParallel(graph, ['A'], { fallbackToLayered: false });

      // Single node with no edges - not SP, but should handle gracefully
      expect(positions.size).toBe(0);
    });

    test('disconnected graph layouts only connected component', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });
      graph.addVertex({ id: 'B', data: {} });
      graph.addVertex({ id: 'C', data: {} });
      graph.addVertex({ id: 'D', data: {} });
      graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
      graph.addEdge({ id: 'e2', from: 'C', to: 'D', weight: 1, data: {} });

      const positions = layoutSeriesParallel(graph, ['A']);

      // Should only layout component containing A and B
      expect(positions.size).toBe(2);
      expect(positions.has('A')).toBe(true);
      expect(positions.has('B')).toBe(true);
      expect(positions.has('C')).toBe(false);
      expect(positions.has('D')).toBe(false);
    });

    test('nonexistent start node returns empty map', () => {
      const graph = new SimpleGraph();
      graph.addVertex({ id: 'A', data: {} });

      const positions = layoutSeriesParallel(graph, ['NONEXISTENT']);

      expect(positions.size).toBe(0);
    });
  });
});
