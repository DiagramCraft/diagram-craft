import { describe, expect, test } from 'vitest';
import { layoutChildren, _test } from './layout';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import type { ElementLayoutInstructions, LayoutNode } from './layoutTree';

const createNode = (
  id: string,
  width: number,
  height: number,
  direction: 'vertical' | 'horizontal' = 'horizontal',
  children: LayoutNode[] = [],
  elementInstructions?: Partial<ElementLayoutInstructions>,
  options?: {
    gap?: number;
    rotation?: number;
    justifyContent?: 'start' | 'end' | 'center' | 'space-between';
    alignItems?: 'start' | 'end' | 'center' | 'stretch' | 'preserve';
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  }
): LayoutNode => ({
  id,
  bounds: { x: 0, y: 0, w: width, h: height, r: options?.rotation ?? 0, _discriminator: 'rw' },
  children,
  containerInstructions: {
    direction,
    ...(options?.gap !== undefined && { gap: options.gap }),
    ...(options?.justifyContent !== undefined && { justifyContent: options.justifyContent }),
    ...(options?.alignItems !== undefined && { alignItems: options.alignItems }),
    ...(options?.padding !== undefined && { padding: options.padding })
  },
  elementInstructions: { width: {}, height: {}, ...elementInstructions }
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
    const child2 = createNode('child2', 100, 100, 'horizontal', [], undefined, {
      rotation: Math.PI / 4
    });
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
    const child2 = createNode('child2', 100, 50, 'vertical', [], undefined, {
      rotation: Math.PI / 4
    });
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

  test('horizontal layout with gap', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 80, 50);
    const child3 = createNode('child3', 120, 50);
    const parent = createNode(
      'parent',
      400,
      50,
      'horizontal',
      [child1, child2, child3],
      undefined,
      { gap: 10 }
    );

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(0);
    expect(child2.bounds.x).toBe(110); // 100 + 10 gap
    expect(child3.bounds.x).toBe(200); // 100 + 10 + 80 + 10
  });

  test('vertical layout with gap', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 100, 80);
    const child3 = createNode('child3', 100, 60);
    const parent = createNode('parent', 100, 250, 'vertical', [child1, child2, child3], undefined, {
      gap: 15
    });

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
    const child1 = createNode('child1', 100, 50, 'horizontal', [], { grow: 1 });
    const child2 = createNode('child2', 100, 50, 'horizontal', [], { grow: 2 });
    // Container is 400px, children total 200px, so 200px extra to distribute
    // child1 gets 1/3 (66.67px), child2 gets 2/3 (133.33px)
    const parent = createNode('parent', 400, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBeCloseTo(166.67, 1); // 100 + 200*(1/3)
    expect(child2.bounds.w).toBeCloseTo(233.33, 1); // 100 + 200*(2/3)
    expect(child2.bounds.x).toBeCloseTo(166.67, 1);
  });

  test('vertical layout grows children with extra space', () => {
    const child1 = createNode('child1', 100, 50, 'vertical', [], { grow: 1 });
    const child2 = createNode('child2', 100, 50, 'vertical', [], { grow: 1 });
    // Container is 200px, children total 100px, so 100px extra to distribute equally
    const parent = createNode('parent', 100, 200, 'vertical', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.h).toBe(100); // 50 + 100/2
    expect(child2.bounds.h).toBe(100); // 50 + 100/2
    expect(child2.bounds.y).toBe(100);
  });

  test('grow respects maximum constraints', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], {
      width: { max: 120 },
      grow: 1
    });
    const child2 = createNode('child2', 100, 50, 'horizontal', [], { grow: 1 });
    const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(120); // Capped at max
  });

  test('horizontal layout shrinks children when needed', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], { shrink: 1 });
    const child2 = createNode('child2', 200, 50, 'horizontal', [], { shrink: 1 });
    // Container is 200px, children total 300px, need to shrink by 100px
    // Shrink is weighted by size: child1 shrinks by 100*(1*100)/(1*100+1*200) = 33.33
    // child2 shrinks by 100*(1*200)/(1*100+1*200) = 66.67
    const parent = createNode('parent', 200, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBeCloseTo(66.67, 1); // 100 - 33.33
    expect(child2.bounds.w).toBeCloseTo(133.33, 1); // 200 - 66.67
    expect(child2.bounds.x).toBeCloseTo(66.67, 1);
  });

  test('shrink respects minimum constraints', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], {
      width: { min: 80 },
      shrink: 1
    });
    const child2 = createNode('child2', 100, 50, 'horizontal', [], { shrink: 1 });
    const parent = createNode('parent', 100, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(80); // Capped at min
  });

  test('no growing without grow factors', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 100, 50);
    const parent = createNode('parent', 400, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    // Sizes should remain unchanged
    expect(child1.bounds.w).toBe(100);
    expect(child2.bounds.w).toBe(100);
  });

  test('no shrinking without shrink factors', () => {
    const child1 = createNode('child1', 150, 50);
    const child2 = createNode('child2', 150, 50);
    const parent = createNode('parent', 200, 50, 'horizontal', [child1, child2]);

    layoutChildren(parent);

    // Sizes should remain unchanged even though they overflow
    expect(child1.bounds.w).toBe(150);
    expect(child2.bounds.w).toBe(150);
  });

  test('gap is preserved when growing', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], { grow: 1 });
    const child2 = createNode('child2', 100, 50, 'horizontal', [], { grow: 1 });
    // Container: 320px, gap: 20px, children: 200px
    // Available space: 320 - 20 = 300px, free space: 100px
    const parent = createNode('parent', 320, 50, 'horizontal', [child1, child2], undefined, {
      gap: 20
    });

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(150); // 100 + 50
    expect(child2.bounds.w).toBe(150); // 100 + 50
    expect(child2.bounds.x).toBe(170); // 150 + 20 gap
  });

  test('horizontal layout with grow preserves aspect ratio', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], {
      grow: 1,
      preserveAspectRatio: true
    });
    // Container is 200px, child is 100px, so 100px extra
    // child grows to 200px width, aspect ratio 2:1, so height becomes 100px
    const parent = createNode('parent', 200, 200, 'horizontal', [child1]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(200);
    expect(child1.bounds.h).toBe(100); // Maintains 2:1 aspect ratio
  });

  test('vertical layout with grow preserves aspect ratio', () => {
    const child1 = createNode('child1', 100, 50, 'vertical', [], {
      grow: 1,
      preserveAspectRatio: true
    });
    // Container is 100px height, child is 50px, so 50px extra
    // child grows to 100px height, aspect ratio 2:1, so width becomes 200px
    const parent = createNode('parent', 300, 100, 'vertical', [child1]);

    layoutChildren(parent);

    expect(child1.bounds.h).toBe(100);
    expect(child1.bounds.w).toBe(200); // Maintains 2:1 aspect ratio
  });

  test('horizontal layout with shrink preserves aspect ratio', () => {
    const child1 = createNode('child1', 200, 100, 'horizontal', [], {
      shrink: 1,
      preserveAspectRatio: true
    });
    // Container is 100px, child is 200px, needs to shrink to 100px
    // Aspect ratio 2:1, so height becomes 50px
    const parent = createNode('parent', 100, 200, 'horizontal', [child1]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(100);
    expect(child1.bounds.h).toBe(50); // Maintains 2:1 aspect ratio
  });

  test('aspect ratio preservation respects cross-axis min constraint', () => {
    const child1 = createNode('child1', 200, 200, 'horizontal', [], {
      height: { min: 120 },
      shrink: 1,
      preserveAspectRatio: true
    });
    // Aspect ratio 1:1, shrinks from 200px to 100px width
    // Would calculate height as 100px, but min is 120px so it becomes 120px
    const parent = createNode('parent', 100, 300, 'horizontal', [child1]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(100);
    expect(child1.bounds.h).toBe(120); // Capped at min constraint
  });

  test('aspect ratio preservation respects cross-axis max constraint', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], {
      height: { max: 80 },
      grow: 1,
      preserveAspectRatio: true
    });
    // Would grow height to 100px to maintain aspect, but max is 80px
    const parent = createNode('parent', 200, 200, 'horizontal', [child1]);

    layoutChildren(parent);

    expect(child1.bounds.w).toBe(200);
    expect(child1.bounds.h).toBe(80); // Capped at max
  });

  test('respects intrinsic minimum from nested children (same direction)', () => {
    // Nested horizontal containers
    const grandchild1 = createNode('grandchild1', 60, 50, 'horizontal', [], { width: { min: 60 } });
    const grandchild2 = createNode('grandchild2', 60, 50, 'horizontal', [], { width: { min: 60 } });
    // Child container: 2 children × 60px + 10px gap = 130px minimum
    const child1 = createNode(
      'child1',
      150,
      50,
      'horizontal',
      [grandchild1, grandchild2],
      { shrink: 1 },
      { gap: 10 }
    );
    // Parent tries to shrink child to 100px, but intrinsic min is 130px
    const parent = createNode('parent', 100, 50, 'horizontal', [child1]);

    layoutChildren(parent);

    // Child should not shrink below intrinsic minimum of 130px
    expect(child1.bounds.w).toBe(130);
  });

  test('respects intrinsic minimum from nested children (perpendicular direction)', () => {
    // Horizontal parent with vertical child
    const grandchild1 = createNode('grandchild1', 80, 30, 'vertical', [], { width: { min: 80 } });
    const grandchild2 = createNode('grandchild2', 100, 30, 'vertical', [], { width: { min: 100 } });
    // Vertical child: max of children's widths = 100px minimum width
    const child1 = createNode('child1', 120, 60, 'vertical', [grandchild1, grandchild2], {
      shrink: 1
    });
    // Parent tries to shrink child to 80px, but intrinsic min width is 100px
    const parent = createNode('parent', 80, 100, 'horizontal', [child1]);

    layoutChildren(parent);

    // Child should not shrink below intrinsic minimum of 100px
    expect(child1.bounds.w).toBe(100);
  });

  test('respects intrinsic maximum from nested children (same direction)', () => {
    // Nested horizontal containers
    const grandchild1 = createNode('grandchild1', 60, 50, 'horizontal', [], { width: { max: 80 } });
    const grandchild2 = createNode('grandchild2', 60, 50, 'horizontal', [], {
      width: { max: 100 }
    });
    // Child container: 2 children with max 80 + 100 + 10px gap = 190px maximum
    const child1 = createNode(
      'child1',
      120,
      50,
      'horizontal',
      [grandchild1, grandchild2],
      { grow: 1 },
      { gap: 10 }
    );
    // Parent tries to grow child to 300px, but intrinsic max is 190px
    const parent = createNode('parent', 300, 50, 'horizontal', [child1]);

    layoutChildren(parent);

    // Child should not grow beyond intrinsic maximum of 190px
    expect(child1.bounds.w).toBe(190);
  });

  test('respects intrinsic maximum from nested children (perpendicular direction)', () => {
    // Horizontal parent with vertical child
    const grandchild1 = createNode('grandchild1', 80, 30, 'vertical', [], { width: { max: 100 } });
    const grandchild2 = createNode('grandchild2', 100, 30, 'vertical', [], { width: { max: 120 } });
    // Vertical child: max of children's widths = 120px maximum width
    const child1 = createNode('child1', 80, 60, 'vertical', [grandchild1, grandchild2], {
      grow: 1
    });
    // Parent tries to grow child to 200px, but intrinsic max width is 120px
    const parent = createNode('parent', 200, 100, 'horizontal', [child1]);

    layoutChildren(parent);

    // Child should not grow beyond intrinsic maximum of 120px
    expect(child1.bounds.w).toBe(120);
  });

  test('horizontal layout applies padding', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 80, 50);
    const parent = createNode(
      'parent',
      220,
      70,
      'horizontal',
      [child1, child2],
      {},
      { padding: { top: 10, right: 20, bottom: 10, left: 20 } }
    );

    layoutChildren(parent);

    // Children should be offset by padding.left
    expect(child1.bounds.x).toBe(20); // padding.left
    expect(child2.bounds.x).toBe(120); // padding.left + child1.width

    // Y positions should not be affected (no grow/shrink)
    expect(child1.bounds.y).toBe(0);
    expect(child2.bounds.y).toBe(0);
  });

  test('vertical layout applies padding', () => {
    const child1 = createNode('child1', 100, 50);
    const child2 = createNode('child2', 100, 80);
    const parent = createNode(
      'parent',
      140,
      160,
      'vertical',
      [child1, child2],
      {},
      { padding: { top: 15, right: 20, bottom: 15, left: 20 } }
    );

    layoutChildren(parent);

    // Children should be offset by padding.top
    expect(child1.bounds.y).toBe(15); // padding.top
    expect(child2.bounds.y).toBe(65); // padding.top + child1.height

    // X positions should not be affected (no grow/shrink)
    expect(child1.bounds.x).toBe(0);
    expect(child2.bounds.x).toBe(0);
  });

  test('padding reduces available space for growing children', () => {
    const child1 = createNode('child1', 100, 50, 'horizontal', [], { grow: 1 });
    // Container: 240px width, padding: 20px left + 20px right = 40px
    // Available space: 240 - 40 = 200px, child: 100px, free space: 100px
    const parent = createNode(
      'parent',
      240,
      50,
      'horizontal',
      [child1],
      {},
      { padding: { top: 0, right: 20, bottom: 0, left: 20 } }
    );

    layoutChildren(parent);

    expect(child1.bounds.x).toBe(20); // padding.left
    expect(child1.bounds.w).toBe(200); // 100 + 100 (grew to fill available space)
  });

  test('padding is included in intrinsic size calculation', () => {
    const grandchild1 = createNode('grandchild1', 60, 50, 'horizontal', [], { width: { min: 60 } });
    const grandchild2 = createNode('grandchild2', 60, 50, 'horizontal', [], { width: { min: 60 } });
    // Child container: 2 children × 60px + 10px gap + 20px padding (10+10) = 150px minimum
    const child1 = createNode(
      'child1',
      150,
      50,
      'horizontal',
      [grandchild1, grandchild2],
      { shrink: 1 },
      { gap: 10, padding: { top: 0, right: 10, bottom: 0, left: 10 } }
    );
    // Parent tries to shrink child to 100px, but intrinsic min is 150px
    const parent = createNode('parent', 100, 50, 'horizontal', [child1]);

    layoutChildren(parent);

    // Child should not shrink below intrinsic minimum of 150px (including padding)
    expect(child1.bounds.w).toBe(150);
  });

  test('padding with gap preserves both spacing types', () => {
    const child1 = createNode('child1', 50, 40);
    const child2 = createNode('child2', 50, 40);
    const parent = createNode(
      'parent',
      130,
      60,
      'horizontal',
      [child1, child2],
      {},
      { gap: 10, padding: { top: 10, right: 10, bottom: 10, left: 10 } }
    );

    layoutChildren(parent);

    // First child offset by padding.left
    expect(child1.bounds.x).toBe(10);
    // Second child offset by padding.left + child1.width + gap
    expect(child2.bounds.x).toBe(70); // 10 + 50 + 10
  });

  describe('justifyContent', () => {
    test('justifyContent: start positions children at the start (default behavior)', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, children: 100px total, free space: 200px
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'start'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(0);
      expect(child2.bounds.x).toBe(50);
    });

    test('justifyContent: end positions children at the end', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, children: 100px total, free space: 200px
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'end'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(200); // 0 + 200 (free space offset)
      expect(child2.bounds.x).toBe(250); // 200 + 50
    });

    test('justifyContent: center centers children in available space', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, children: 100px total, free space: 200px
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'center'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(100); // 0 + 100 (half of free space)
      expect(child2.bounds.x).toBe(150); // 100 + 50
    });

    test('justifyContent: space-between distributes space evenly', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      const child3 = createNode('child3', 50, 50);
      // Container: 350px, children: 150px total, free space: 200px
      // space-between: 200 / (3-1) = 100px between each child
      const parent = createNode(
        'parent',
        350,
        50,
        'horizontal',
        [child1, child2, child3],
        undefined,
        {
          justifyContent: 'space-between'
        }
      );

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(0);
      expect(child2.bounds.x).toBe(150); // 0 + 50 + 100 (itemSpacing)
      expect(child3.bounds.x).toBe(300); // 150 + 50 + 100 (itemSpacing)
    });

    test('justifyContent with gap: gap is included in total space calculation', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, children: 100px total, gap: 10px, free space: 190px
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2], undefined, {
        gap: 10,
        justifyContent: 'center'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(95); // 0 + 95 (half of 190px free space)
      expect(child2.bounds.x).toBe(155); // 95 + 50 + 10 (gap)
    });

    test('justifyContent with padding: padding offset applied first', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, children: 100px total, padding: 10px left+right
      // Available space: 280px, free space: 180px
      const parent = createNode(
        'parent',
        300,
        50,
        'horizontal',
        [child1, child2],
        {},
        { justifyContent: 'center', padding: { left: 10, right: 10 } }
      );

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(100); // 10 (padding.left) + 90 (half of 180px free space)
      expect(child2.bounds.x).toBe(150); // 100 + 50
    });

    test('justifyContent with gap and padding', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px, padding: 20px left+right, gap: 10px
      // Available space: 260px, children+gap: 110px, free space: 150px
      const parent = createNode(
        'parent',
        300,
        50,
        'horizontal',
        [child1, child2],
        {},
        { gap: 10, justifyContent: 'end', padding: { left: 20, right: 20 } }
      );

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(170); // 20 (padding.left) + 150 (free space offset)
      expect(child2.bounds.x).toBe(230); // 170 + 50 + 10 (gap)
    });

    test('justifyContent disabled when children have grow > 0', () => {
      const child1 = createNode('child1', 50, 50, 'horizontal', [], { grow: 1 });
      const child2 = createNode('child2', 50, 50, 'horizontal', [], { grow: 1 });
      // Container: 300px, children: 100px total, free space: 200px
      // With grow, children should expand to fill space, not justify
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'center'
      });

      layoutChildren(parent);

      // Children should grow instead of being centered
      expect(child1.bounds.x).toBe(0);
      expect(child1.bounds.w).toBe(150); // 50 + 100 (half of free space)
      expect(child2.bounds.x).toBe(150);
      expect(child2.bounds.w).toBe(150);
    });

    test('justifyContent disabled when overflow with shrink', () => {
      const child1 = createNode('child1', 100, 50, 'horizontal', [], { shrink: 1 });
      const child2 = createNode('child2', 100, 50, 'horizontal', [], { shrink: 1 });
      // Container: 150px, children: 200px total, free space: -50px (overflow)
      // With shrink, children should shrink, not justify
      const parent = createNode('parent', 150, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'center'
      });

      layoutChildren(parent);

      // Children should shrink instead of being centered
      expect(child1.bounds.x).toBe(0);
      expect(child1.bounds.w).toBe(75); // 100 - 25 (half of overflow)
      expect(child2.bounds.x).toBe(75);
      expect(child2.bounds.w).toBe(75);
    });

    test('space-between with single child falls back to start behavior', () => {
      const child1 = createNode('child1', 50, 50);
      // Container: 300px, children: 50px, free space: 250px
      const parent = createNode('parent', 300, 50, 'horizontal', [child1], undefined, {
        justifyContent: 'space-between'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(0); // Should be at start, not centered
    });

    test('justifyContent with zero free space does nothing', () => {
      const child1 = createNode('child1', 100, 50);
      const child2 = createNode('child2', 100, 50);
      // Container: 200px, children: 200px, free space: 0px
      const parent = createNode('parent', 200, 50, 'horizontal', [child1, child2], undefined, {
        justifyContent: 'center'
      });

      layoutChildren(parent);

      expect(child1.bounds.x).toBe(0);
      expect(child2.bounds.x).toBe(100);
    });

    test('justifyContent in vertical layout', () => {
      const child1 = createNode('child1', 50, 50);
      const child2 = createNode('child2', 50, 50);
      // Container: 300px height, children: 100px total, free space: 200px
      const parent = createNode('parent', 50, 300, 'vertical', [child1, child2], undefined, {
        justifyContent: 'center'
      });

      layoutChildren(parent);

      expect(child1.bounds.y).toBe(100); // 0 + 100 (half of free space)
      expect(child2.bounds.y).toBe(150); // 100 + 50
    });

    test('nested containers with different justifyContent', () => {
      const innerChild1 = createNode('innerChild1', 30, 30);
      const innerChild2 = createNode('innerChild2', 30, 30);
      // Inner container: 100px, children: 60px, free space: 40px, justify: end
      const innerContainer = createNode(
        'inner',
        100,
        30,
        'horizontal',
        [innerChild1, innerChild2],
        undefined,
        { justifyContent: 'end' }
      );

      const outerChild = createNode('outerChild', 50, 30);
      // Outer container: 300px, children: 150px, free space: 150px, justify: center
      const outerContainer = createNode(
        'outer',
        300,
        30,
        'horizontal',
        [innerContainer, outerChild],
        undefined,
        { justifyContent: 'center' }
      );

      layoutChildren(outerContainer);

      // Outer container centered
      expect(innerContainer.bounds.x).toBe(75); // 0 + 75 (half of 150px free space)
      expect(outerChild.bounds.x).toBe(175); // 75 + 100

      // Inner container justified to end
      expect(innerChild1.bounds.x).toBe(40); // 0 + 40 (free space offset)
      expect(innerChild2.bounds.x).toBe(70); // 40 + 30
    });
  });

  describe('alignItems', () => {
    describe('horizontal layout (cross-axis = vertical)', () => {
      test('alignItems: preserve maintains original y position (default)', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        child1.bounds.y = 5; // Set initial y position
        child2.bounds.y = 10;
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'preserve'
        });

        layoutChildren(parent);

        // Y positions should remain unchanged
        expect(child1.bounds.y).toBe(5);
        expect(child2.bounds.y).toBe(10);
      });

      test('alignItems: start aligns children to top', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'start'
        });

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(0);
        expect(child2.bounds.y).toBe(0);
      });

      test('alignItems: end aligns children to bottom', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        // Container: 100px high
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'end'
        });

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(70); // 100 - 30
        expect(child2.bounds.y).toBe(60); // 100 - 40
      });

      test('alignItems: center centers children vertically', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'center'
        });

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(35); // (100 - 30) / 2
        expect(child2.bounds.y).toBe(30); // (100 - 40) / 2
      });

      test('alignItems: stretch stretches children to fill height', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'stretch'
        });

        layoutChildren(parent);

        expect(child1.bounds.h).toBe(100);
        expect(child2.bounds.h).toBe(100);
        expect(child1.bounds.y).toBe(0);
        expect(child2.bounds.y).toBe(0);
      });
    });

    describe('vertical layout (cross-axis = horizontal)', () => {
      test('alignItems: start aligns children to left', () => {
        const child1 = createNode('child1', 30, 50);
        const child2 = createNode('child2', 40, 50);
        const parent = createNode('parent', 100, 300, 'vertical', [child1, child2], undefined, {
          alignItems: 'start'
        });

        layoutChildren(parent);

        expect(child1.bounds.x).toBe(0);
        expect(child2.bounds.x).toBe(0);
      });

      test('alignItems: end aligns children to right', () => {
        const child1 = createNode('child1', 30, 50);
        const child2 = createNode('child2', 40, 50);
        const parent = createNode('parent', 100, 300, 'vertical', [child1, child2], undefined, {
          alignItems: 'end'
        });

        layoutChildren(parent);

        expect(child1.bounds.x).toBe(70); // 100 - 30
        expect(child2.bounds.x).toBe(60); // 100 - 40
      });

      test('alignItems: center centers children horizontally', () => {
        const child1 = createNode('child1', 30, 50);
        const child2 = createNode('child2', 40, 50);
        const parent = createNode('parent', 100, 300, 'vertical', [child1, child2], undefined, {
          alignItems: 'center'
        });

        layoutChildren(parent);

        expect(child1.bounds.x).toBe(35); // (100 - 30) / 2
        expect(child2.bounds.x).toBe(30); // (100 - 40) / 2
      });

      test('alignItems: stretch stretches children to fill width', () => {
        const child1 = createNode('child1', 30, 50);
        const child2 = createNode('child2', 40, 50);
        const parent = createNode('parent', 100, 300, 'vertical', [child1, child2], undefined, {
          alignItems: 'stretch'
        });

        layoutChildren(parent);

        expect(child1.bounds.w).toBe(100);
        expect(child2.bounds.w).toBe(100);
        expect(child1.bounds.x).toBe(0);
        expect(child2.bounds.x).toBe(0);
      });
    });

    describe('integration tests', () => {
      test('alignItems with padding', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        // Container: 100px high, padding: 10px top+bottom
        // Available: 80px, children centered in available space
        const parent = createNode(
          'parent',
          300,
          100,
          'horizontal',
          [child1, child2],
          {},
          { alignItems: 'center', padding: { top: 10, bottom: 10 } }
        );

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(35); // 10 + (80 - 30) / 2
        expect(child2.bounds.y).toBe(30); // 10 + (80 - 40) / 2
      });

      test('alignItems with justifyContent (both axes aligned)', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        // Container: 300x100, children: 100px wide, 200px free horizontal
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          justifyContent: 'center',
          alignItems: 'center'
        });

        layoutChildren(parent);

        // Horizontal (main axis) centered
        expect(child1.bounds.x).toBe(100); // 0 + 100 (half of 200px free)
        expect(child2.bounds.x).toBe(150); // 100 + 50
        // Vertical (cross axis) centered
        expect(child1.bounds.y).toBe(35); // (100 - 30) / 2
        expect(child2.bounds.y).toBe(30); // (100 - 40) / 2
      });

      test('alignItems with gap (gap should not affect cross axis)', () => {
        const child1 = createNode('child1', 50, 30);
        const child2 = createNode('child2', 50, 40);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          gap: 20,
          alignItems: 'center'
        });

        layoutChildren(parent);

        // Gap should only affect main axis (x positions)
        expect(child1.bounds.x).toBe(0);
        expect(child2.bounds.x).toBe(70); // 50 + 20 gap
        // Cross axis should be centered
        expect(child1.bounds.y).toBe(35);
        expect(child2.bounds.y).toBe(30);
      });

      test('alignItems: stretch with preserveAspectRatio (aspect ratio wins)', () => {
        const child1 = createNode('child1', 50, 30, 'horizontal', [], {
          preserveAspectRatio: true
        });
        const child2 = createNode('child2', 50, 40);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1, child2], undefined, {
          alignItems: 'stretch'
        });

        layoutChildren(parent);

        // child1 should NOT stretch (preserveAspectRatio enabled)
        expect(child1.bounds.h).toBe(30);
        expect(child1.bounds.y).toBe(35); // Centered: (100 - 30) / 2
        // child2 should stretch
        expect(child2.bounds.h).toBe(100);
        expect(child2.bounds.y).toBe(0);
      });
    });

    describe('edge cases', () => {
      test('different child sizes with alignItems: center', () => {
        const child1 = createNode('child1', 50, 20);
        const child2 = createNode('child2', 50, 60);
        const child3 = createNode('child3', 50, 40);
        const parent = createNode(
          'parent',
          300,
          100,
          'horizontal',
          [child1, child2, child3],
          undefined,
          {
            alignItems: 'center'
          }
        );

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(40); // (100 - 20) / 2
        expect(child2.bounds.y).toBe(20); // (100 - 60) / 2
        expect(child3.bounds.y).toBe(30); // (100 - 40) / 2
      });

      test('single child with alignItems', () => {
        const child1 = createNode('child1', 50, 30);
        const parent = createNode('parent', 300, 100, 'horizontal', [child1], undefined, {
          alignItems: 'center'
        });

        layoutChildren(parent);

        expect(child1.bounds.y).toBe(35); // (100 - 30) / 2
      });

      test('nested containers with different alignItems', () => {
        const innerChild1 = createNode('innerChild1', 30, 20);
        const innerChild2 = createNode('innerChild2', 30, 25);
        const innerContainer = createNode(
          'inner',
          100,
          50,
          'horizontal',
          [innerChild1, innerChild2],
          undefined,
          { alignItems: 'end' }
        );

        const outerChild = createNode('outerChild', 50, 30);
        const outerContainer = createNode(
          'outer',
          300,
          100,
          'horizontal',
          [innerContainer, outerChild],
          undefined,
          { alignItems: 'center' }
        );

        layoutChildren(outerContainer);

        // Outer container children centered
        expect(innerContainer.bounds.y).toBe(25); // (100 - 50) / 2
        expect(outerChild.bounds.y).toBe(35); // (100 - 30) / 2

        // Inner container children aligned to bottom
        expect(innerChild1.bounds.y).toBe(30); // 50 - 20
        expect(innerChild2.bounds.y).toBe(25); // 50 - 25
      });
    });
  });

  describe('enabled property', () => {
    test('layout disabled on parent still recurses to children', () => {
      const grandchild1 = createNode('grandchild1', 40, 30, 'horizontal', [], { grow: 1 });
      const grandchild2 = createNode('grandchild2', 60, 30, 'horizontal', [], { grow: 1 });
      // Child has layout enabled, should grow children
      const child1 = createNode('child1', 200, 30, 'horizontal', [grandchild1, grandchild2]);

      // Parent has layout disabled
      const parent = createNode('parent', 400, 100, 'horizontal', [child1]);
      parent.containerInstructions.enabled = false;

      layoutChildren(parent);

      // Parent should not layout child1, so child1 position should remain unchanged
      expect(child1.bounds.x).toBe(0);
      expect(child1.bounds.w).toBe(200); // Not resized

      // But child1's children should still be laid out (grew to fill 200px)
      expect(grandchild1.bounds.w).toBe(90); // 40 + 50 (half of 100px extra)
      expect(grandchild2.bounds.w).toBe(110); // 60 + 50 (half of 100px extra)
    });

    test('layout disabled skips positioning but recurses', () => {
      const innerChild1 = createNode('innerChild1', 50, 30);
      const innerChild2 = createNode('innerChild2', 50, 30);
      const innerContainer = createNode('inner', 100, 30, 'horizontal', [innerChild1, innerChild2]);

      const outerContainer = createNode('outer', 300, 30, 'horizontal', [innerContainer]);
      outerContainer.containerInstructions.enabled = false;

      layoutChildren(outerContainer);

      // Outer container should not layout its children
      expect(innerContainer.bounds.x).toBe(0);

      // But inner container should still layout its children
      expect(innerChild1.bounds.x).toBe(0);
      expect(innerChild2.bounds.x).toBe(50);
    });

    test('layout enabled by default when undefined', () => {
      const child1 = createNode('child1', 50, 50, 'horizontal', [], { grow: 1 });
      const child2 = createNode('child2', 50, 50, 'horizontal', [], { grow: 1 });
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2]);
      // enabled is undefined, should default to enabled

      layoutChildren(parent);

      // Layout should be applied normally
      expect(child1.bounds.w).toBe(150); // Grew
      expect(child2.bounds.w).toBe(150); // Grew
    });

    test('layout explicitly enabled works normally', () => {
      const child1 = createNode('child1', 50, 50, 'horizontal', [], { grow: 1 });
      const child2 = createNode('child2', 50, 50, 'horizontal', [], { grow: 1 });
      const parent = createNode('parent', 300, 50, 'horizontal', [child1, child2]);
      parent.containerInstructions.enabled = true;

      layoutChildren(parent);

      // Layout should be applied normally
      expect(child1.bounds.w).toBe(150); // Grew
      expect(child2.bounds.w).toBe(150); // Grew
    });
  });
});

// Unit tests for internal helper functions
describe('getAxisConstraints', () => {
  test('returns width constraints for horizontal axis', () => {
    const node = createNode('test', 100, 50, 'horizontal', [], {
      width: { min: 10, max: 200 },
      height: { min: 5, max: 100 }
    });

    const result = _test.getAxisConstraints(node, 'horizontal');
    expect(result).toEqual({ min: 10, max: 200 });
  });

  test('returns height constraints for vertical axis', () => {
    const node = createNode('test', 100, 50, 'vertical', [], {
      width: { min: 10, max: 200 },
      height: { min: 5, max: 100 }
    });

    const result = _test.getAxisConstraints(node, 'vertical');
    expect(result).toEqual({ min: 5, max: 100 });
  });
});

describe('getIntrinsicSize', () => {
  test('returns 0 for min size of leaf nodes', () => {
    const node = createNode('leaf', 100, 50);
    expect(_test.getIntrinsicSize(node, 'horizontal', 'min')).toBe(0);
  });

  test('returns Infinity for max size of leaf nodes', () => {
    const node = createNode('leaf', 100, 50);
    expect(_test.getIntrinsicSize(node, 'horizontal', 'max')).toBe(Infinity);
  });

  test('sums children min sizes in same direction', () => {
    const child1 = createNode('child1', 50, 30, 'horizontal', [], { width: { min: 60 } });
    const child2 = createNode('child2', 40, 30, 'horizontal', [], { width: { min: 50 } });
    const parent = createNode('parent', 200, 30, 'horizontal', [child1, child2], undefined, {
      gap: 10
    });

    // Should be 60 + 50 + 10 (gap) = 120
    expect(_test.getIntrinsicSize(parent, 'horizontal', 'min')).toBe(120);
  });

  test('takes max of children min sizes in perpendicular direction', () => {
    const child1 = createNode('child1', 50, 30, 'vertical', [], { width: { min: 80 } });
    const child2 = createNode('child2', 40, 30, 'vertical', [], { width: { min: 100 } });
    const parent = createNode('parent', 200, 60, 'vertical', [child1, child2]);

    // Should be max(80, 100) = 100
    expect(_test.getIntrinsicSize(parent, 'horizontal', 'min')).toBe(100);
  });

  test('returns Infinity if any child has unbounded max in same direction', () => {
    const child1 = createNode('child1', 50, 30, 'horizontal', [], { width: { max: 100 } });
    const child2 = createNode('child2', 40, 30, 'horizontal', []); // No max = Infinity
    const parent = createNode('parent', 200, 30, 'horizontal', [child1, child2]);

    expect(_test.getIntrinsicSize(parent, 'horizontal', 'max')).toBe(Infinity);
  });
});

describe('applyGrow', () => {
  test('distributes extra space proportionally based on grow factors', () => {
    const childInfo = [
      {
        child: createNode('c1', 100, 50),
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100,
        crossAxisSize: undefined,
        grow: 1,
        shrink: 0,
        min: 0,
        max: Infinity
      },
      {
        child: createNode('c2', 100, 50),
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100,
        crossAxisSize: undefined,
        grow: 2,
        shrink: 0,
        min: 0,
        max: Infinity
      }
    ];

    _test.applyGrow(childInfo, 150); // 150px extra space

    expect(childInfo[0]!.finalSize).toBe(150); // 100 + 150*(1/3)
    expect(childInfo[1]!.finalSize).toBe(200); // 100 + 150*(2/3)
  });

  test('respects maximum constraints', () => {
    const childInfo = [
      {
        child: createNode('c1', 100, 50),
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100,
        crossAxisSize: undefined,
        grow: 1,
        shrink: 0,
        min: 0,
        max: 120
      }
    ];

    _test.applyGrow(childInfo, 100);

    expect(childInfo[0]!.finalSize).toBe(120); // Capped at max
  });
});

describe('applyShrink', () => {
  test('reduces sizes proportionally weighted by original size', () => {
    const childInfo = [
      {
        child: createNode('c1', 100, 50),
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100,
        crossAxisSize: undefined,
        grow: 0,
        shrink: 1,
        min: 0,
        max: Infinity
      },
      {
        child: createNode('c2', 200, 50),
        boundingBox: { x: 0, y: 0, w: 200, h: 50, r: 0 },
        originalSize: 200,
        finalSize: 200,
        crossAxisSize: undefined,
        grow: 0,
        shrink: 1,
        min: 0,
        max: Infinity
      }
    ];

    _test.applyShrink(childInfo, -90); // Need to shrink by 90px

    // child1: shrinks by 90 * (1*100)/(1*100+1*200) = 30
    // child2: shrinks by 90 * (1*200)/(1*100+1*200) = 60
    expect(childInfo[0]!.finalSize).toBeCloseTo(70, 1);
    expect(childInfo[1]!.finalSize).toBeCloseTo(140, 1);
  });

  test('respects minimum constraints', () => {
    const childInfo = [
      {
        child: createNode('c1', 100, 50),
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100,
        crossAxisSize: undefined,
        grow: 0,
        shrink: 1,
        min: 80,
        max: Infinity
      }
    ];

    _test.applyShrink(childInfo, -50);

    expect(childInfo[0]!.finalSize).toBe(80); // Capped at min
  });
});

describe('applyAspectRatio', () => {
  test('calculates cross-axis size for horizontal layout', () => {
    const child = createNode('c1', 100, 50);
    child.elementInstructions.preserveAspectRatio = true;

    const childInfo = [
      {
        child,
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 200, // Doubled
        crossAxisSize: undefined,
        grow: 1,
        shrink: 0,
        min: 0,
        max: Infinity
      }
    ];

    _test.applyAspectRatio(childInfo, true);

    // Aspect ratio 2:1, new width 200, so height should be 100
    expect(childInfo[0]!.crossAxisSize).toBe(100);
  });

  test('respects cross-axis constraints', () => {
    const child = createNode('c1', 100, 50);
    child.elementInstructions.preserveAspectRatio = true;
    child.elementInstructions.height = { max: 80 };

    const childInfo = [
      {
        child,
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 200,
        crossAxisSize: undefined,
        grow: 1,
        shrink: 0,
        min: 0,
        max: Infinity
      }
    ];

    _test.applyAspectRatio(childInfo, true);

    // Would be 100, but capped at max of 80
    expect(childInfo[0]!.crossAxisSize).toBe(80);
  });

  test('does not apply if size unchanged', () => {
    const child = createNode('c1', 100, 50);
    child.elementInstructions.preserveAspectRatio = true;

    const childInfo = [
      {
        child,
        boundingBox: { x: 0, y: 0, w: 100, h: 50, r: 0 },
        originalSize: 100,
        finalSize: 100, // Unchanged
        crossAxisSize: undefined,
        grow: 0,
        shrink: 0,
        min: 0,
        max: Infinity
      }
    ];

    _test.applyAspectRatio(childInfo, true);

    expect(childInfo[0]!.crossAxisSize).toBeUndefined();
  });
});

describe('calculateJustifyOffset', () => {
  test('returns zero offsets when justifyContent is undefined', () => {
    const result = _test.calculateJustifyOffset(undefined, 100, 3);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });

  test('returns zero offsets when freeSpace is zero', () => {
    const result = _test.calculateJustifyOffset('center', 0, 3);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });

  test('returns zero offsets when freeSpace is negative', () => {
    const result = _test.calculateJustifyOffset('center', -50, 3);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });

  test('start returns zero offsets', () => {
    const result = _test.calculateJustifyOffset('start', 100, 3);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });

  test('end returns full free space as initial offset', () => {
    const result = _test.calculateJustifyOffset('end', 200, 3);

    expect(result).toEqual({ initialOffset: 200, itemSpacing: 0 });
  });

  test('center returns half of free space as initial offset', () => {
    const result = _test.calculateJustifyOffset('center', 200, 3);

    expect(result).toEqual({ initialOffset: 100, itemSpacing: 0 });
  });

  test('space-between distributes space evenly between items', () => {
    const result = _test.calculateJustifyOffset('space-between', 200, 3);

    // 200 / (3-1) = 100px between each item
    expect(result).toEqual({ initialOffset: 0, itemSpacing: 100 });
  });

  test('space-between with two children', () => {
    const result = _test.calculateJustifyOffset('space-between', 150, 2);

    // 150 / (2-1) = 150px between the two items
    expect(result).toEqual({ initialOffset: 0, itemSpacing: 150 });
  });

  test('space-between with single child returns zero offsets', () => {
    const result = _test.calculateJustifyOffset('space-between', 200, 1);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });

  test('space-between with zero children returns zero offsets', () => {
    const result = _test.calculateJustifyOffset('space-between', 200, 0);

    expect(result).toEqual({ initialOffset: 0, itemSpacing: 0 });
  });
});

describe('calculateAlignOffset', () => {
  test('returns 0 when alignItems is undefined', () => {
    const result = _test.calculateAlignOffset(undefined, 100, 30, 0, 0);

    expect(result).toBe(0);
  });

  test('returns 0 when alignItems is preserve', () => {
    const result = _test.calculateAlignOffset('preserve', 100, 30, 0, 0);

    expect(result).toBe(0);
  });

  test('start returns padding start offset', () => {
    const result = _test.calculateAlignOffset('start', 100, 30, 10, 10);

    expect(result).toBe(10); // crossPaddingStart
  });

  test('start without padding returns 0', () => {
    const result = _test.calculateAlignOffset('start', 100, 30, 0, 0);

    expect(result).toBe(0);
  });

  test('end returns correct offset', () => {
    const result = _test.calculateAlignOffset('end', 100, 30, 0, 0);

    expect(result).toBe(70); // 100 - 30
  });

  test('end with padding accounts for padding end', () => {
    const result = _test.calculateAlignOffset('end', 100, 30, 10, 10);

    expect(result).toBe(60); // 100 - 30 - 10 (paddingEnd)
  });

  test('center returns half of available space', () => {
    const result = _test.calculateAlignOffset('center', 100, 30, 0, 0);

    expect(result).toBe(35); // 0 + (100 - 30) / 2
  });

  test('center with padding centers in available space', () => {
    const result = _test.calculateAlignOffset('center', 100, 30, 10, 10);

    expect(result).toBe(35); // 10 + (80 - 30) / 2
  });

  test('stretch returns padding start offset', () => {
    const result = _test.calculateAlignOffset('stretch', 100, 100, 10, 10);

    expect(result).toBe(10); // crossPaddingStart
  });
});

describe('getStretchSize', () => {
  test('returns undefined when alignItems is not stretch', () => {
    const child = createNode('test', 50, 30);
    const result = _test.getStretchSize('center', 100, 0, 0, child, 'vertical');

    expect(result).toBeUndefined();
  });

  test('returns undefined when preserveAspectRatio is enabled', () => {
    const child = createNode('test', 50, 30, 'horizontal', [], { preserveAspectRatio: true });
    const result = _test.getStretchSize('stretch', 100, 0, 0, child, 'vertical');

    expect(result).toBeUndefined();
  });

  test('returns available size when stretching without constraints', () => {
    const child = createNode('test', 50, 30);
    const result = _test.getStretchSize('stretch', 100, 0, 0, child, 'vertical');

    expect(result).toBe(100);
  });

  test('returns available size minus padding', () => {
    const child = createNode('test', 50, 30);
    const result = _test.getStretchSize('stretch', 100, 10, 10, child, 'vertical');

    expect(result).toBe(80); // 100 - 10 - 10
  });

  test('respects min constraint when stretching', () => {
    const child = createNode('test', 50, 30, 'horizontal', [], { height: { min: 120 } });
    const result = _test.getStretchSize('stretch', 100, 0, 0, child, 'vertical');

    expect(result).toBe(120); // Enforced min (even if larger than container)
  });
});
