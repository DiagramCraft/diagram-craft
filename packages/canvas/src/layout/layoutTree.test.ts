import { describe, expect, test } from 'vitest';
import { buildLayoutTree, applyLayoutTree } from './layoutTree';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('buildLayoutTree', () => {
  test('root node keeps absolute bounds', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const root = layer.addNode({
      bounds: {
        x: 100,
        y: 100,
        w: 400,
        h: 200,
        r: Math.PI / 6 // 30 degrees
      }
    });

    const layoutTree = buildLayoutTree(root);

    expect(layoutTree.bounds.x).toBe(100);
    expect(layoutTree.bounds.y).toBe(100);
    expect(layoutTree.bounds.w).toBe(400);
    expect(layoutTree.bounds.h).toBe(200);
    expect(layoutTree.bounds.r).toBe(Math.PI / 6);
  });

  test('child node has relative position to parent', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const parent = layer.addNode({
      bounds: {
        x: 100,
        y: 100,
        w: 400,
        h: 200,
        r: Math.PI / 6 // 30 degrees
      }
    });
    const child = layer.createNode({
      bounds: {
        x: 110,
        y: 100,
        w: 40,
        h: 20,
        r: Math.PI / 6 + Math.PI / 18 // 40 degrees (30 + 10)
      }
    });
    UnitOfWork.execute(diagram, {}, uow => parent.addChild(child, uow));

    const layoutTree = buildLayoutTree(parent);

    expect(layoutTree.children).toHaveLength(1);
    const childLayout = layoutTree.children[0]!;

    // Child position should be relative to parent
    expect(childLayout.bounds.x).toBe(10); // 110 - 100
    expect(childLayout.bounds.y).toBe(0); // 100 - 100
    expect(childLayout.bounds.w).toBe(40);
    expect(childLayout.bounds.h).toBe(20);
    expect(childLayout.bounds.r).toBeCloseTo(Math.PI / 18, 10); // 10 degrees (40 - 30)
  });

  test('nested children have relative positions', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const root = layer.addNode({ bounds: { x: 100, y: 100, w: 400, h: 200, r: 0 } });
    const child1 = layer.createNode({ bounds: { x: 120, y: 130, w: 200, h: 100, r: 0.5 } });
    const grandchild = layer.createNode({ bounds: { x: 130, y: 140, w: 50, h: 30, r: 0.7 } });

    UnitOfWork.execute(diagram, uow => {
      root.addChild(child1, uow);
      child1.addChild(grandchild, uow);
    });

    const layoutTree = buildLayoutTree(root);

    // Root
    expect(layoutTree.bounds.x).toBe(100);
    expect(layoutTree.bounds.y).toBe(100);

    // Child1 relative to root
    const child1Layout = layoutTree.children[0]!;
    expect(child1Layout.bounds.x).toBe(20); // 120 - 100
    expect(child1Layout.bounds.y).toBe(30); // 130 - 100
    expect(child1Layout.bounds.r).toBe(0.5);

    // Grandchild relative to child1
    const grandchildLayout = child1Layout.children[0]!;
    expect(grandchildLayout.bounds.x).toBe(10); // 130 - 120
    expect(grandchildLayout.bounds.y).toBe(10); // 140 - 130
    expect(grandchildLayout.bounds.r).toBeCloseTo(0.2, 10); // 0.7 - 0.5
  });
});

describe('applyLayoutTree', () => {
  test('applies absolute bounds to root node', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const root = layer.addNode({ bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 } });

    const layoutTree = buildLayoutTree(root);
    // Modify the layout
    layoutTree.bounds.x = 200;
    layoutTree.bounds.y = 150;
    layoutTree.bounds.w = 300;
    layoutTree.bounds.h = 250;

    UnitOfWork.execute(diagram, uow => applyLayoutTree(root, layoutTree, uow));

    expect(root.bounds.x).toBe(200);
    expect(root.bounds.y).toBe(150);
    expect(root.bounds.w).toBe(300);
    expect(root.bounds.h).toBe(250);
  });

  test('converts relative child bounds back to absolute', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const parent = layer.addNode({ bounds: { x: 100, y: 100, w: 400, h: 200, r: 0 } });
    const child = layer.createNode({ bounds: { x: 110, y: 100, w: 40, h: 20, r: 0 } });
    UnitOfWork.execute(diagram, uow => parent.addChild(child, uow));

    const layoutTree = buildLayoutTree(parent);
    // Modify child's relative position
    layoutTree.children[0]!.bounds.x = 50; // New relative position
    layoutTree.children[0]!.bounds.y = 25;

    UnitOfWork.execute(diagram, uow => applyLayoutTree(parent, layoutTree, uow));

    // Child should have absolute position = parent + relative
    expect(child.bounds.x).toBe(150); // 100 + 50
    expect(child.bounds.y).toBe(125); // 100 + 25
  });

  test('converts relative rotation back to absolute', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const parent = layer.addNode({ bounds: { x: 100, y: 100, w: 400, h: 200, r: Math.PI / 6 } });
    const child = layer.createNode({
      bounds: {
        x: 110,
        y: 100,
        w: 40,
        h: 20,
        r: Math.PI / 6 + Math.PI / 18
      }
    });
    UnitOfWork.execute(diagram, uow => parent.addChild(child, uow));

    const layoutTree = buildLayoutTree(parent);
    // Child should have relative rotation of PI/18 (10 degrees)
    expect(layoutTree.children[0]!.bounds.r).toBeCloseTo(Math.PI / 18, 10);

    // Modify child's relative rotation
    layoutTree.children[0]!.bounds.r = Math.PI / 9; // 20 degrees

    UnitOfWork.execute(diagram, uow => applyLayoutTree(parent, layoutTree, uow));

    // Child should have absolute rotation = parent + relative
    expect(child.bounds.r).toBeCloseTo(Math.PI / 6 + Math.PI / 9, 10); // 30 + 20 = 50 degrees
  });

  test('round-trip preserves bounds', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const parent = layer.addNode({ bounds: { x: 100, y: 50, w: 400, h: 200, r: 0.3 } });
    const child1 = layer.createNode({ bounds: { x: 120, y: 80, w: 150, h: 80, r: 0.5 } });
    const child2 = layer.createNode({ bounds: { x: 280, y: 80, w: 100, h: 80, r: 0.6 } });
    UnitOfWork.execute(diagram, uow => {
      parent.addChild(child1, uow);
      parent.addChild(child2, uow);
    });

    // Build layout tree and apply it back without modifications
    const layoutTree = buildLayoutTree(parent);
    UnitOfWork.execute(diagram, uow => applyLayoutTree(parent, layoutTree, uow));

    // Bounds should be unchanged
    expect(parent.bounds.x).toBe(100);
    expect(parent.bounds.y).toBe(50);
    expect(parent.bounds.r).toBeCloseTo(0.3, 10);
    expect(child1.bounds.x).toBe(120);
    expect(child1.bounds.y).toBe(80);
    expect(child1.bounds.r).toBeCloseTo(0.5, 10);
    expect(child2.bounds.x).toBe(280);
    expect(child2.bounds.y).toBe(80);
    expect(child2.bounds.r).toBeCloseTo(0.6, 10);
  });
});
