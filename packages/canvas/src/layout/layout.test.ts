import { describe, expect, test } from 'vitest';
import { layoutChildren, type LayoutNode } from './layout';
import { Box } from '@diagram-craft/geometry/box';

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
});
