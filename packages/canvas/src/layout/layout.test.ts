import { describe, expect, test } from 'vitest';
import { layoutChildren, type LayoutNode } from './layout';
import { Box, WritableBox } from '@diagram-craft/geometry/box';

const createNode = (
  id: string,
  width: number,
  height: number,
  direction: 'vertical' | 'horizontal' = 'horizontal',
  children: LayoutNode[] = []
): LayoutNode => ({
  id,
  bounds: Box.asReadWrite({ x: 0, y: 0, w: width, h: height, r: 0, _discriminator: 'ro' }),
  children,
  containerInstructions: { direction },
  elementInstructions: {}
});

describe('layoutChildren', () => {
  test('horizontal layout positions children left to right', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 80, 50);
    const child3 = createNode('child3', 120, 50);
    const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2, child3]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(100);
    expect(child2.bounds.y).toBe(0);

    expect(child3.bounds.x).toBe(180);
    expect(child3.bounds.y).toBe(0);
  });

  test('vertical layout positions children top to bottom', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 100, 80);
    const child3 = createNode('child3', 100, 60);
    const parent = createNode('parent', 100, 190, 'vertical', [child1, child2, child3]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(0);
    expect(child2.bounds.y).toBe(50);

    expect(child3.bounds.x).toBe(0);
    expect(child3.bounds.y).toBe(130);
  });

  test('nested layouts are recursively applied', () => {
    const grandchild1 = createNode('grandchild1', 40, 30);
    const grandchild2 = createNode('grandchild2', 60, 30);
    const child1 = createNode('child1', 100, 50, 'horizontal', [grandchild1, grandchild2]);
    const child2 = createNode('child2', 100, 80);
    const parent = createNode('parent', 100, 130, 'vertical', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(0);

    expect(grandchild1.bounds.x).toBe(0);
    expect(grandchild1.bounds.y).toBe(0);

    expect(grandchild2.bounds.x).toBe(40);
    expect(grandchild2.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(0);
    expect(child2.bounds.y).toBe(50);
  });

  test('empty children array does nothing', () => {
    const parent = createNode('parent', 100, 100, 'horizontal', []);

    layoutChildren(parent);

    expect(parent.bounds.x).toBe(0);
    expect(parent.bounds.y).toBe(0);
  });

  test('horizontal layout accounts for rotated children', () => {
    const child1 = createNode('child1', 100, 50);
    // Create a rotated square - 100x100 rotated 45 degrees
    // Bounding box should be ~141.42x141.42
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 100, r: Math.PI / 4, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: {}
    };
    const child3 = createNode('child3', 80, 50);
    const parent = createNode('parent', 400, 150, 'horizontal', [child1, child2, child3]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(100);
    expect(child2.bounds.y).toBe(0);

    // child3 should be positioned after the rotated bounding box of child2
    // sqrt(100^2 + 100^2) ≈ 141.42
    const expectedX = 100 + Math.sqrt(100 * 100 + 100 * 100);
    expect(child3.bounds.x).toBeCloseTo(expectedX, 1);
    expect(child3.bounds.y).toBe(0);
  });

  test('vertical layout accounts for rotated children', () => {
    const child1 = createNode('child1', 100, 50);
    // Create a rotated rectangle - 100x50 rotated 45 degrees
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: Math.PI / 4, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: {}
    };
    const child3 = createNode('child3', 100, 60);
    const parent = createNode('parent', 200, 300, 'vertical', [child1, child2, child3]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(0);
    expect(child2.bounds.y).toBe(50);

    // child3 should be positioned after the rotated bounding box of child2
    // For a 100x50 rectangle rotated 45 degrees, the bounding box height can be calculated
    const rotatedBoundingBox = Box.boundingBox([WritableBox.asBox(child2.bounds)], true);
    const expectedY = 50 + rotatedBoundingBox.h;
    expect(child3.bounds.y).toBeCloseTo(expectedY, 1);
    expect(child3.bounds.x).toBe(0);
  });

  test('horizontal layout preserves y positions', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 10, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: {}
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 20, w: 80, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: {}
    };
    const parent = createNode('parent', 200, 100, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child1.bounds.y).toBe(10); // Preserved

    expect(child2.bounds.x).toBe(100);
    expect(child2.bounds.y).toBe(20); // Preserved
  });

  test('vertical layout preserves x positions', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 10, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: {}
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 20, y: 0, w: 100, h: 80, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: {}
    };
    const parent = createNode('parent', 200, 200, 'vertical', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(10); // Preserved
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(20); // Preserved
    expect(child2.bounds.y).toBe(50);
  });
});
