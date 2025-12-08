import { describe, test, expect } from 'vitest';
import { SimpleGraph } from '../graph';
import { layoutOrthogonal } from './orthogonalLayout';

describe('layoutOrthogonal', () => {
  test('single node returns position at origin', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(1);
    expect(positions.get('A')).toEqual({ x: 0, y: 0 });
  });

  test('two nodes in linear arrangement', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);

    // A should be in one layer, B in the next
    const posA = positions.get('A')!;
    const posB = positions.get('B')!;
    expect(Math.abs(posB.y - posA.y)).toBeGreaterThan(0);
  });

  test('simple DAG with branching', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(3);
    const posA = positions.get('A')!;
    const posB = positions.get('B')!;
    const posC = positions.get('C')!;

    // B and C should be in the same layer (same y)
    expect(posB.y).toBe(posC.y);

    // A should be in a different layer
    expect(posA.y).not.toBe(posB.y);
  });

  test('grid spacing option', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A'], { gridSpacing: 2 });

    const posA = positions.get('A')!;
    const posB = positions.get('B')!;
    const distance = Math.sqrt((posB.x - posA.x) ** 2 + (posB.y - posA.y) ** 2);

    // With spacing 2, nodes should be 2 units apart
    expect(distance).toBeCloseTo(2);
  });

  test('direction: down', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A'], { direction: 'down' });

    const posA = positions.get('A')!;
    const posB = positions.get('B')!;

    // B should be below A (larger y)
    expect(posB.y).toBeGreaterThan(posA.y);
  });

  test('direction: up', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A'], { direction: 'up' });

    const posA = positions.get('A')!;
    const posB = positions.get('B')!;

    // B should be above A (smaller y)
    expect(posB.y).toBeLessThan(posA.y);
  });

  test('direction: left', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A'], { direction: 'left' });

    const posA = positions.get('A')!;
    const posB = positions.get('B')!;

    // B should be to the left of A (smaller x)
    expect(posB.x).toBeLessThan(posA.x);
  });

  test('direction: right', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A'], { direction: 'right' });

    const posA = positions.get('A')!;
    const posB = positions.get('B')!;

    // B should be to the right of A (larger x)
    expect(posB.x).toBeGreaterThan(posA.x);
  });

  test('empty start IDs returns empty map', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutOrthogonal(graph, []);

    expect(positions.size).toBe(0);
  });

  test('nonexistent start ID returns empty map', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutOrthogonal(graph, ['Z' as any]);

    expect(positions.size).toBe(0);
  });

  test('disconnected vertices are not included', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('disabled edges are ignored', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {}, disabled: true });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('diamond-shaped DAG', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'C', to: 'D', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(4);

    // All nodes should have valid positions
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(positions.has(id)).toBe(true);
      const pos = positions.get(id)!;
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  test('larger hierarchical graph', () => {
    const graph = new SimpleGraph();

    // Root
    graph.addVertex({ id: 'A', data: {} });

    // Level 1
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'A', to: 'D', weight: 1, data: {} });

    // Level 2
    graph.addVertex({ id: 'E', data: {} });
    graph.addVertex({ id: 'F', data: {} });
    graph.addEdge({ id: 'e4', from: 'B', to: 'E', weight: 1, data: {} });
    graph.addEdge({ id: 'e5', from: 'C', to: 'F', weight: 1, data: {} });

    const positions = layoutOrthogonal(graph, ['A']);

    expect(positions.size).toBe(6);

    // Verify all nodes have valid positions
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(positions.has(id)).toBe(true);
      const pos = positions.get(id)!;
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });
});
