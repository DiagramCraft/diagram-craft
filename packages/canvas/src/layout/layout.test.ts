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
  elementInstructions: { width: {}, height: {} }
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
      elementInstructions: { width: {}, height: {} }
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
      elementInstructions: { width: {}, height: {} }
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
      elementInstructions: { width: {}, height: {} }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 20, w: 80, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
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
      elementInstructions: { width: {}, height: {} }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 20, y: 0, w: 100, h: 80, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {} }
    };
    const parent = createNode('parent', 200, 200, 'vertical', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(10); // Preserved
    expect(child1.bounds.y).toBe(0);

    expect(child2.bounds.x).toBe(20); // Preserved
    expect(child2.bounds.y).toBe(50);
  });

  test('horizontal layout with gap', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 80, 50);
    const child3 = createNode('child3', 120, 50);
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 400, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2, child3],
      containerInstructions: { direction: 'horizontal', gap: 10 },
      elementInstructions: {}
    };

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child2.bounds.x).toBe(110); // 100 + 10 gap
    expect(child3.bounds.x).toBe(200); // 100 + 10 + 80 + 10
  });

  test('vertical layout with gap', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 100, 80);
    const child3 = createNode('child3', 100, 60);
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 250, r: 0, _discriminator: 'ro' }),
      children: [child1, child2, child3],
      containerInstructions: { direction: 'vertical', gap: 15 },
      elementInstructions: {}
    };

    layoutChildren(parent);

    expect(child1.bounds.y).toBe(0);
    expect(child2.bounds.y).toBe(65); // 50 + 15 gap
    expect(child3.bounds.y).toBe(160); // 50 + 15 + 80 + 15
  });

  test('gap defaults to 0 when not specified', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 80, 50);
    const parent = createNode('parent', 180, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child2.bounds.x).toBe(100); // No gap
  });

  test('horizontal layout grows children with extra space', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 2 }
    };
    // Container is 400px, children total 200px, so 200px extra to distribute
    // child1 gets 1/3 (66.67px), child2 gets 2/3 (133.33px)
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 400, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBeCloseTo(166.67, 1); // 100 + 200*(1/3)
    expect(child2.bounds.w).toBeCloseTo(233.33, 1); // 100 + 200*(2/3)
    expect(child2.bounds.x).toBeCloseTo(166.67, 1);
  });

  test('vertical layout grows children with extra space', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    // Container is 200px, children total 100px, so 100px extra to distribute equally
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 200, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.h).toBe(100); // 50 + 100/2
    expect(child2.bounds.h).toBe(100); // 50 + 100/2
    expect(child2.bounds.y).toBe(100);
  });

  test('grow respects maximum constraints', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: { max: 120 }, height: {}, grow: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 300, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(120); // Capped at max
  });

  test('horizontal layout shrinks children when needed', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, shrink: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, shrink: 1 }
    };
    // Container is 200px, children total 300px, need to shrink by 100px
    // Shrink is weighted by size: child1 shrinks by 100*(1*100)/(1*100+1*200) = 33.33
    // child2 shrinks by 100*(1*200)/(1*100+1*200) = 66.67
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBeCloseTo(66.67, 1); // 100 - 33.33
    expect(child2.bounds.w).toBeCloseTo(133.33, 1); // 200 - 66.67
    expect(child2.bounds.x).toBeCloseTo(66.67, 1);
  });

  test('shrink respects minimum constraints', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: { min: 80 }, height: {}, shrink: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, shrink: 1 }
    };
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(80); // Capped at min
  });

  test('no growing without grow factors', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 400, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    // Sizes should remain unchanged
    expect(child1.bounds.w).toBe(100);
    expect(child2.bounds.w).toBe(100);
  });

  test('no shrinking without shrink factors', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 150, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 150, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    // Sizes should remain unchanged even though they overflow
    expect(child1.bounds.w).toBe(150);
    expect(child2.bounds.w).toBe(150);
  });

  test('gap is preserved when growing', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    const child2: LayoutNode = {
      id: 'child2',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 1 }
    };
    // Container: 320px, gap: 20px, children: 200px
    // Available space: 320 - 20 = 300px, free space: 100px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 320, h: 50, r: 0, _discriminator: 'ro' }),
      children: [child1, child2],
      containerInstructions: { direction: 'horizontal', gap: 20 },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(150); // 100 + 50
    expect(child2.bounds.w).toBe(150); // 100 + 50
    expect(child2.bounds.x).toBe(170); // 150 + 20 gap
  });

  test('horizontal layout with grow preserves aspect ratio', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, grow: 1, preserveAspectRatio: true }
    };
    // Container is 200px, child is 100px, so 100px extra
    // child grows to 200px width, aspect ratio 2:1, so height becomes 100px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 200, r: 0, _discriminator: 'ro' }),
      children: [child1],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(200);
    expect(child1.bounds.h).toBe(100); // Maintains 2:1 aspect ratio
  });

  test('vertical layout with grow preserves aspect ratio', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {}, grow: 1, preserveAspectRatio: true }
    };
    // Container is 100px height, child is 50px, so 50px extra
    // child grows to 100px height, aspect ratio 2:1, so width becomes 200px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 300, h: 100, r: 0, _discriminator: 'ro' }),
      children: [child1],
      containerInstructions: { direction: 'vertical' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.h).toBe(100);
    expect(child1.bounds.w).toBe(200); // Maintains 2:1 aspect ratio
  });

  test('horizontal layout with shrink preserves aspect ratio', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 100, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {}, shrink: 1, preserveAspectRatio: true }
    };
    // Container is 100px, child is 200px, needs to shrink to 100px
    // Aspect ratio 2:1, so height becomes 50px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 200, r: 0, _discriminator: 'ro' }),
      children: [child1],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(100);
    expect(child1.bounds.h).toBe(50); // Maintains 2:1 aspect ratio
  });

  test('aspect ratio preservation respects cross-axis min constraint', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 200, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: { min: 120 }, shrink: 1, preserveAspectRatio: true }
    };
    // Aspect ratio 1:1, shrinks from 200px to 100px width
    // Would calculate height as 100px, but min is 120px so it becomes 120px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 300, r: 0, _discriminator: 'ro' }),
      children: [child1],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(100);
    expect(child1.bounds.h).toBe(120); // Capped at min constraint
  });

  test('aspect ratio preservation respects cross-axis max constraint', () => {
    const child1: LayoutNode = {
      id: 'child1',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 100, h: 50, r: 0, _discriminator: 'ro' }),
      children: [],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: { max: 80 }, grow: 1, preserveAspectRatio: true }
    };
    // Would grow height to 100px to maintain aspect, but max is 80px
    const parent: LayoutNode = {
      id: 'parent',
      bounds: Box.asReadWrite({ x: 0, y: 0, w: 200, h: 200, r: 0, _discriminator: 'ro' }),
      children: [child1],
      containerInstructions: { direction: 'horizontal' },
      elementInstructions: { width: {}, height: {} }
    };

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(200);
    expect(child1.bounds.h).toBe(80); // Capped at max
  });
});
