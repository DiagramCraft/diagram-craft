/*
 * Copyright (c) 2025 Magnus Johansson
 * SPDX-License-Identifier: ISC
 */

import { describe, test, expect } from 'vitest';
import { SimpleGraph } from '../graph';
import { layoutTree } from './treeLayout';

describe('layoutTree', () => {
  test('single node returns position at origin', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(1);
    expect(positions.get('A')).toEqual({ x: 0, y: 0 });
  });

  test('simple parent-child relationship', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(2);
    expect(positions.get('A')).toEqual({ x: 0, y: 0 });
    expect(positions.get('B')).toEqual({ x: 0, y: 1 });
  });

  test('binary tree layout', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(3);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(1);

    // Parent should be centered between children
    const posA = positions.get('A')!;
    const posB = positions.get('B')!;
    const posC = positions.get('C')!;
    expect(posA.x).toBeCloseTo((posB.x + posC.x) / 2);
  });

  test('three-level tree', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addVertex({ id: 'E', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'B', to: 'D', weight: 1, data: {} });
    graph.addEdge({ id: 'e4', from: 'B', to: 'E', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(5);
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(1);
    expect(positions.get('D')?.y).toBe(2);
    expect(positions.get('E')?.y).toBe(2);
  });

  test('horizontal spacing option', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A', { horizontalSpacing: 2 });

    const posB = positions.get('B')!;
    const posC = positions.get('C')!;
    const horizontalDist = Math.abs(posC.x - posB.x);
    expect(horizontalDist).toBe(2);
  });

  test('vertical spacing option', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A', { verticalSpacing: 3 });

    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(3);
  });

  test('direction: up', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A', { direction: 'up' });

    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(-1);
  });

  test('direction: left', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A', { direction: 'left' });

    expect(positions.get('A')?.x).toBe(0);
    expect(positions.get('B')?.x).toBe(-1);
  });

  test('direction: right', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A', { direction: 'right' });

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

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('nonexistent root returns empty map', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });

    const positions = layoutTree(graph, 'Z' as any);

    expect(positions.size).toBe(0);
  });

  test('disconnected vertices are not included', () => {
    const graph = new SimpleGraph();
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(2);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(false);
  });

  test('larger tree with multiple branches', () => {
    const graph = new SimpleGraph();

    // Root with 3 children
    graph.addVertex({ id: 'A', data: {} });
    graph.addVertex({ id: 'B', data: {} });
    graph.addVertex({ id: 'C', data: {} });
    graph.addVertex({ id: 'D', data: {} });
    graph.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 1, data: {} });
    graph.addEdge({ id: 'e2', from: 'A', to: 'C', weight: 1, data: {} });
    graph.addEdge({ id: 'e3', from: 'A', to: 'D', weight: 1, data: {} });

    // B has 2 children
    graph.addVertex({ id: 'E', data: {} });
    graph.addVertex({ id: 'F', data: {} });
    graph.addEdge({ id: 'e4', from: 'B', to: 'E', weight: 1, data: {} });
    graph.addEdge({ id: 'e5', from: 'B', to: 'F', weight: 1, data: {} });

    // C has 1 child
    graph.addVertex({ id: 'G', data: {} });
    graph.addEdge({ id: 'e6', from: 'C', to: 'G', weight: 1, data: {} });

    const positions = layoutTree(graph, 'A');

    expect(positions.size).toBe(7);

    // Verify all depths
    expect(positions.get('A')?.y).toBe(0);
    expect(positions.get('B')?.y).toBe(1);
    expect(positions.get('C')?.y).toBe(1);
    expect(positions.get('D')?.y).toBe(1);
    expect(positions.get('E')?.y).toBe(2);
    expect(positions.get('F')?.y).toBe(2);
    expect(positions.get('G')?.y).toBe(2);
  });
});
