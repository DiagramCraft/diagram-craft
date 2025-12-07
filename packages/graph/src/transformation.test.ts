import { describe, test, expect } from 'vitest';
import { SimpleGraph } from './graph';
import { extractMaximalTree } from './transformation';

describe('extractMaximalTree', () => {
  test('extracts simple tree from linear graph', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.vertices).toHaveLength(3);
    expect(result!.edges).toHaveLength(2);
    expect(result!.vertices.map(v => v.id)).toEqual(['A', 'B', 'C']);
  });

  test('extracts tree and excludes cycles', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'C', to: 'D', weight: 1, data: {} }); // Creates cycle

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.vertices).toHaveLength(4);
    expect(result!.edges).toHaveLength(3); // Only 3 edges for tree with 4 vertices
  });

  test('returns undefined for non-existent root', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const result = extractMaximalTree(graph, 'Z');

    expect(result).toBeUndefined();
  });

  test('extracts single vertex tree', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.vertices).toHaveLength(1);
    expect(result!.edges).toHaveLength(0);
    expect(result!.vertices[0]!.id).toBe('A');
  });

  test('extracts only connected component', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'C', to: 'D', weight: 1, data: {} }); // Disconnected

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.vertices).toHaveLength(2);
    expect(result!.edges).toHaveLength(1);
    expect(result!.vertices.map(v => v.id)).toEqual(['A', 'B']);
  });

  test('skips disabled edges', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {}, disabled: true });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.vertices).toHaveLength(2);
    expect(result!.edges).toHaveLength(1);
    expect(result!.vertices.map(v => v.id)).toEqual(['A', 'B']);
  });

  test('builds children map correctly', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.children.get('A')?.map(v => v.id).sort()).toEqual(['B', 'C']);
    expect(result!.children.get('B')?.map(v => v.id)).toEqual(['D']);
    expect(result!.children.get('C')).toEqual([]);
    expect(result!.children.get('D')).toEqual([]);
  });

  test('builds ancestors map correctly', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });

    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'B', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'C', to: 'D', weight: 1, data: {} });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();

    // A is root, has no ancestors
    expect(result!.ancestors.get('A')).toEqual([]);

    // B's ancestors: [A]
    expect(result!.ancestors.get('B')?.map(v => v.id)).toEqual(['A']);

    // C's ancestors: [B, A]
    expect(result!.ancestors.get('C')?.map(v => v.id)).toEqual(['B', 'A']);

    // D's ancestors: [C, B, A]
    expect(result!.ancestors.get('D')?.map(v => v.id)).toEqual(['C', 'B', 'A']);
  });

  test('children and ancestors are empty for single vertex', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const result = extractMaximalTree(graph, 'A');

    expect(result).toBeDefined();
    expect(result!.children.get('A')).toEqual([]);
    expect(result!.ancestors.get('A')).toEqual([]);
  });
});
