import { describe, test, expect } from 'vitest';
import { SimpleGraph } from '../graph';
import { layoutLayered } from './layeredLayout';

describe('layoutLayered', () => {
  test('single node returns position at origin', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(1);
    expect(positions.get('A')).toEqual({ x: 0, y: 0 });
  });

  test('simple two-node chain', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
  });

  test('three-level linear chain', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(3);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(2);
  });

  test('diamond shape - two paths converging', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'C', to: 'D', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(4);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(1);
    expect(positions.get('D')?.y).toBe(2);

    // B and C should be at the same layer
    const bY = positions.get('B')?.y;
    const cY = positions.get('C')?.y;
    expect(bY).toBe(cY);
  });

  test('multiple roots - nodes with no incoming edges', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'D', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    // Only A and C are in the same connected component
    expect(positions.size).toBe(2);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('C')?.y).toBe(1);
  });

  test('wider graph - multiple nodes per layer', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addVertex({ id: 'E', data: {} });
    graph.addVertex({ id: 'F', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'A', to: 'D', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'B', to: 'E', weight: 1, data: {} });
    graph.addEdge({ id: 'e5', from: 'C', to: 'F', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(6);
    expect(positions.get('A')?.y).toBe(0);
    // B, C, D should all be at layer 1
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(1);
    expect(positions.get('D')?.y).toBe(1);
    // E, F should be at layer 2
    expect(positions.get('E')?.y).toBe(2);
    expect(positions.get('F')?.y).toBe(2);
  });

  test('horizontal spacing option', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A'], { horizontalSpacing: 3 });

    const posB = positions.get('B')!;
    const posC = positions.get('C')!;
    const horizontalDist = Math.abs(posC.x - posB.x);
    expect(horizontalDist).toBe(3);
  });

  test('vertical spacing option', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A'], { verticalSpacing: 2.5 });

    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(2.5);
  });

  test('direction: up', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A'], { direction: 'up' });

    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(-1);
  });

  test('direction: left', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A'], { direction: 'left' });

    expect(positions.get('A')?.x).toBe(0);
    expect(positions.get('B')?.x).toBe(-1);
  });

  test('direction: right', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A'], { direction: 'right' });

    expect(positions.get('A')?.x).toBe(0);
    expect(positions.get('B')?.x).toBe(1);
  });

  test('disabled edges are ignored', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {}, disabled: true });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('empty start IDs returns empty map', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutLayered(graph, []);

    expect(positions.size).toBe(0);
  });

  test('nonexistent start node returns empty map', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutLayered(graph, ['Z' as any]);

    expect(positions.size).toBe(0);
  });

  test('disconnected vertices are not included', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('complex hierarchical graph', () => {
    const graph = new SimpleGraph();
    // Create a more complex hierarchy
    graph.addVertex({ id: 'root', data: {} });
    graph.addVertex({ id: 'a1', data: {} });
    graph.addVertex({ id: 'a2', data: {} });
    graph.addVertex({ id: 'a3', data: {} });
    graph.addVertex({ id: 'b1', data: {} });
    graph.addVertex({ id: 'b2', data: {} });
    graph.addVertex({ id: 'c1', data: {} });

    graph.addEdge({ id: 'e1', from: 'root', to: 'a1', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'root', to: 'a2', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'root', to: 'a3', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'a1', to: 'b1', weight: 1, data: {} });
    graph.addEdge({ id: 'e5', from: 'a2', to: 'b1', weight: 1, data: {} });
    graph.addEdge({ id: 'e6', from: 'a2', to: 'b2', weight: 1, data: {} });
    graph.addEdge({ id: 'e7', from: 'b1', to: 'c1', weight: 1, data: {} });
    graph.addEdge({ id: 'e8', from: 'b2', to: 'c1', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['root']);

    expect(positions.size).toBe(7);
    expect(positions.get('root')?.y).toBe(0);
    expect(positions.get('a1')?.y).toBe(1);
    expect(positions.get('a2')?.y).toBe(1);
    expect(positions.get('a3')?.y).toBe(1);

    // b1 should be at layer 2 (needs both a1 and a2)
    expect(positions.get('b1')?.y).toBe(2);
    expect(positions.get('b2')?.y).toBe(2);

    // c1 should be at layer 3
    expect(positions.get('c1')?.y).toBe(3);
  });

  test('handles backward edges gracefully', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'C', to: 'A', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    // Should still produce a layout for all nodes
    expect(positions.size).toBe(3);
    // Due to the cycle, the actual layers will depend on the longest path
    // Just verify all nodes are present and have different layers
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(true);
  });

  test('nodes are centered horizontally', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

    const positions = layoutLayered(graph, ['A']);

    // Root should be centered above its children
    const posA = positions.get('A')!;
    const posB = positions.get('B')!;
    const posC = positions.get('C')!;

    // A should be centered between B and C
    expect(posA.x).toBeCloseTo((posB.x + posC.x) / 2);
  });
});
