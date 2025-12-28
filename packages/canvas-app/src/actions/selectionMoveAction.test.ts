import { describe, test, expect, beforeEach } from 'vitest';
import { SelectionMoveAction } from './selectionMoveAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { model } from '@diagram-craft/canvas/modelState';
import {
  TestDiagramBuilder,
  TestModel,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const context: ActionContext = { model };

describe('SelectionMoveAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    model.activeDiagram = diagram;
  });

  describe('Regular movement', () => {
    test('should move node by 1px to the right', () => {
      const node = layer.addNode({ id: 'node1', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } });
      diagram.selection.setElements([node]);

      const action = new SelectionMoveAction(context, () => ({ x: 1, y: 0 }));
      action.execute();

      expect(node.bounds.x).toBe(101);
      expect(node.bounds.y).toBe(100);
    });
  });

  describe('Grid movement', () => {
    test('should move node by grid size to the right', () => {
      const node = layer.addNode({ id: 'node1', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } });
      diagram.selection.setElements([node]);

      const action = new SelectionMoveAction(context, () => ({ x: 10, y: 0 }));
      action.execute();

      expect(node.bounds.x).toBe(110);
      expect(node.bounds.y).toBe(100);
    });
  });

  describe('Container layout reordering - horizontal', () => {
    test('should swap with sibling when moving right in horizontal layout', () => {
      // Create parent with horizontal layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'horizontal',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      // Add two children
      const child1 = layer.addNode({
        id: 'child1',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });
      const child2 = layer.addNode({
        id: 'child2',
        bounds: { x: 70, y: 10, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child1, uow2);
      parent.addChild(child2, uow2);
      uow2.commit();

      diagram.selection.setElements([child1]);

      const action = new SelectionMoveAction(context, () => ({ x: 1, y: 0 }));
      action.execute();

      // child1 should now be positioned past child2's left edge
      expect(child1.bounds.x).toBeGreaterThan(child2.bounds.x);
    });

    test('should swap with sibling when moving left in horizontal layout', () => {
      // Create parent with horizontal layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'horizontal',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      // Add two children
      const child1 = layer.addNode({
        id: 'child1',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });
      const child2 = layer.addNode({
        id: 'child2',
        bounds: { x: 70, y: 10, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child1, uow2);
      parent.addChild(child2, uow2);
      uow2.commit();

      diagram.selection.setElements([child2]);

      const action = new SelectionMoveAction(context, () => ({ x: -1, y: 0 }));
      action.execute();

      // child2 should now be positioned before child1's left edge
      expect(child2.bounds.x).toBeLessThan(child1.bounds.x);
    });
  });

  describe('Container layout reordering - vertical', () => {
    test('should swap with sibling when moving down in vertical layout', () => {
      // Create parent with vertical layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 100, h: 300, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'vertical',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      // Add two children
      const child1 = layer.addNode({
        id: 'child1',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });
      const child2 = layer.addNode({
        id: 'child2',
        bounds: { x: 10, y: 70, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child1, uow2);
      parent.addChild(child2, uow2);
      uow2.commit();

      diagram.selection.setElements([child1]);

      const action = new SelectionMoveAction(context, () => ({ x: 0, y: 1 }));
      action.execute();

      // child1 should now be positioned past child2's top edge
      expect(child1.bounds.y).toBeGreaterThan(child2.bounds.y);
    });

    test('should swap with sibling when moving up in vertical layout', () => {
      // Create parent with vertical layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 100, h: 300, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'vertical',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      // Add two children
      const child1 = layer.addNode({
        id: 'child1',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });
      const child2 = layer.addNode({
        id: 'child2',
        bounds: { x: 10, y: 70, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child1, uow2);
      parent.addChild(child2, uow2);
      uow2.commit();

      diagram.selection.setElements([child2]);

      const action = new SelectionMoveAction(context, () => ({ x: 0, y: -1 }));
      action.execute();

      // child2 should now be positioned before child1's top edge
      expect(child2.bounds.y).toBeLessThan(child1.bounds.y);
    });
  });

  describe('Edge cases', () => {
    test('should fall back to regular movement when moving perpendicular to layout axis', () => {
      // Create parent with horizontal layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'horizontal',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      const child = layer.addNode({
        id: 'child',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child, uow2);
      uow2.commit();

      diagram.selection.setElements([child]);

      const action = new SelectionMoveAction(context, () => ({ x: 0, y: 1 }));
      action.execute();

      // Should move normally, not swap
      expect(child.bounds.y).toBe(11);
    });

    test('should fall back to regular movement when node is absolutely positioned', () => {
      // Create parent with horizontal layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'horizontal',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      const child = layer.addNode({
        id: 'child',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child, uow2);
      child.updateProps(
        p =>
          (p.layout = {
            element: {
              isAbsolute: true
            }
          }),
        uow2
      );
      uow2.commit();

      diagram.selection.setElements([child]);

      const action = new SelectionMoveAction(context, () => ({ x: 1, y: 0 }));
      action.execute();

      // Should move normally, not swap
      expect(child.bounds.x).toBe(11);
    });

    test('should fall back to regular movement at boundary (no sibling to swap with)', () => {
      // Create parent with horizontal layout
      const parent = layer.addNode({
        id: 'parent',
        bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 }
      });

      const uow = new UnitOfWork(diagram);
      parent.updateProps(
        p =>
          (p.layout = {
            container: {
              direction: 'horizontal',
              enabled: true
            }
          }),
        uow
      );
      uow.commit();

      // Only one child - no sibling to swap with
      const child = layer.addNode({
        id: 'child',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 }
      });

      const uow2 = new UnitOfWork(diagram);
      parent.addChild(child, uow2);
      uow2.commit();

      diagram.selection.setElements([child]);

      const action = new SelectionMoveAction(context, () => ({ x: 1, y: 0 }));
      action.execute();

      // Should move normally
      expect(child.bounds.x).toBe(11);
    });
  });
});
