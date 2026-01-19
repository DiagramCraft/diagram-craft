import { describe, expect, test } from 'vitest';
import {
  getAllDescendants,
  getAnchorPositionForBounds,
  getBoundsRelativeToCollapsedAncestor,
  getCollapsedAncestor,
  getExpandedBounds,
  getPositionInBoundsForBox
} from './collapsible';
import { UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { TestModel } from './test-support/testModel';

describe('collapsible', () => {
  describe('getCollapsedAncestor', () => {
    test('returns null when node has no parent', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      expect(getCollapsedAncestor(node)).toBeNull();
    });

    test('returns null when parent is not collapsible', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const parent = layer.addNode({ type: 'rect' });
      const child = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: parent
        });
      });

      expect(getCollapsedAncestor(child)).toBeNull();
    });

    test('returns null when parent container is not collapsed', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({ type: 'container' });
      const child = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: container
        });
      });

      expect(getCollapsedAncestor(child)).toBeNull();
    });

    test('returns collapsed parent container', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({ type: 'container' });
      const child = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: container
        });

        container.updateCustomProps(
          '_collapsible',
          (props: any) => {
            props.mode = 'collapsed';
            props.bounds = Box.toString({ x: 0, y: 0, w: 200, h: 200, r: 0 });
          },
          uow
        );
      });

      expect(getCollapsedAncestor(child)).toBe(container);
    });

    test('returns nearest collapsed ancestor when multiple levels', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const outerContainer = layer.addNode({ type: 'container' });
      const innerContainer = layer.addNode({ type: 'container' });
      const child = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([innerContainer], uow, layer, {
          relation: 'on',
          element: outerContainer
        });
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: innerContainer
        });

        innerContainer.updateCustomProps(
          '_collapsible',
          (props: any) => {
            props.mode = 'collapsed';
            props.bounds = Box.toString({ x: 10, y: 10, w: 200, h: 200, r: 0 });
          },
          uow
        );
      });

      expect(getCollapsedAncestor(child)).toBe(innerContainer);
    });
  });

  describe('getExpandedBounds', () => {
    test('returns current bounds when node is not collapsed', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({
        type: 'container',
        bounds: { x: 10, y: 20, w: 100, h: 150, r: 0.5 }
      });

      const bounds = getExpandedBounds(node);
      expect(bounds).toStrictEqual({ x: 10, y: 20, w: 100, h: 150, r: 0.5 });
    });

    test('returns expanded bounds when node is collapsed', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({
        type: 'container',
        bounds: { x: 10, y: 20, w: 50, h: 50, r: 0 }
      });

      UnitOfWork.execute(diagram, uow => {
        node.updateCustomProps(
          '_collapsible',
          (props: any) => {
            props.mode = 'collapsed';
            props.bounds = Box.toString({ x: 5, y: 15, w: 200, h: 300, r: 0.3 });
          },
          uow
        );
      });

      const bounds = getExpandedBounds(node);
      expect(bounds).toStrictEqual({
        x: 10,
        y: 20,
        w: 200,
        h: 300,
        r: node.bounds.r
      });
    });
  });

  describe('getBoundsRelativeToCollapsedAncestor', () => {
    test('returns current bounds when no collapsed ancestor', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({
        bounds: { x: 10, y: 20, w: 50, h: 60, r: 0 }
      });

      const bounds = getBoundsRelativeToCollapsedAncestor(node);
      expect(bounds).toStrictEqual({ x: 10, y: 20, w: 50, h: 60, r: 0 });
    });

    test('calculates proportional bounds for node in collapsed container', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({
        type: 'container',
        bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 }
      });
      const child = layer.addNode({
        type: 'rect',
        bounds: { x: 50, y: 50, w: 100, h: 100, r: 0 }
      });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: container
        });

        container.updateCustomProps(
          '_collapsible',
          (props: any) => {
            props.mode = 'collapsed';
            props.bounds = Box.toString({ x: 0, y: 0, w: 200, h: 200, r: 0 });
          },
          uow
        );
      });

      const bounds = getBoundsRelativeToCollapsedAncestor(child);

      expect(bounds.x).toBe(12.5);
      expect(bounds.y).toBe(12.5);
      expect(bounds.w).toBe(25);
      expect(bounds.h).toBe(25);
    });

    test('maintains node rotation', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({
        type: 'container',
        bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 }
      });
      const child = layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 1.2 }
      });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: container
        });

        container.updateCustomProps(
          '_collapsible',
          (props: any) => {
            props.mode = 'collapsed';
            props.bounds = Box.toString({ x: 0, y: 0, w: 100, h: 100, r: 0 });
          },
          uow
        );
      });

      const bounds = getBoundsRelativeToCollapsedAncestor(child);
      expect(bounds.r).toBe(1.2);
    });
  });

  describe('getPositionInBoundsForBox', () => {
    test('converts normalized coordinates to absolute position', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const bounds = { x: 10, y: 20, w: 100, h: 200, r: 0 };
      const point = { x: 0.5, y: 0.5 };

      const result = getPositionInBoundsForBox(node, point, bounds);
      expect(result).toStrictEqual({ x: 60, y: 120 });
    });

    test('respects rotation when enabled', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const bounds = { x: 0, y: 0, w: 100, h: 100, r: Math.PI / 2 };
      const point = { x: 1, y: 0 };

      const result = getPositionInBoundsForBox(node, point, bounds, true);
      expect(result).toBeDefined();
    });

    test('ignores rotation when disabled', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const bounds = { x: 10, y: 20, w: 100, h: 200, r: Math.PI };
      const point = { x: 0.5, y: 0.5 };

      const result = getPositionInBoundsForBox(node, point, bounds, false);
      expect(result).toStrictEqual({ x: 60, y: 120 });
    });

    test('handles horizontal flip', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        node.updateProps((p: any) => {
          p.geometry = p.geometry ?? {};
          p.geometry.flipH = true;
        }, uow);
      });

      const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 0.25, y: 0.5 };

      const result = getPositionInBoundsForBox(node, point, bounds, false);
      expect(result).toStrictEqual({ x: 75, y: 50 });
    });

    test('handles vertical flip', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        node.updateProps((p: any) => {
          p.geometry = p.geometry ?? {};
          p.geometry.flipV = true;
        }, uow);
      });

      const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      const point = { x: 0.5, y: 0.25 };

      const result = getPositionInBoundsForBox(node, point, bounds, false);
      expect(result).toStrictEqual({ x: 50, y: 75 });
    });
  });

  describe('getAnchorPositionForBounds', () => {
    test('returns anchor position for given bounds', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({ type: 'rect' });

      const bounds = { x: 10, y: 20, w: 200, h: 300, r: 0 };
      const result = getAnchorPositionForBounds(node, 'c', bounds);

      expect(result.x).toBe(110);
      expect(result.y).toBe(170);
    });
  });

  describe('getAllDescendants', () => {
    test('returns empty array for node with no children', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const descendants = getAllDescendants(node);
      expect(descendants).toStrictEqual([]);
    });

    test('returns direct children', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const parent = layer.addNode({ type: 'container' });
      const child1 = layer.addNode({ type: 'rect' });
      const child2 = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child1, child2], uow, layer, {
          relation: 'on',
          element: parent
        });
      });

      const descendants = getAllDescendants(parent);
      expect(descendants).toHaveLength(2);
      expect(descendants).toContain(child1);
      expect(descendants).toContain(child2);
    });

    test('returns nested descendants recursively', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const grandparent = layer.addNode({ type: 'container' });
      const parent = layer.addNode({ type: 'container' });
      const child = layer.addNode({ type: 'rect' });

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([parent], uow, layer, {
          relation: 'on',
          element: grandparent
        });
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: parent
        });
      });

      const descendants = getAllDescendants(grandparent);
      expect(descendants).toHaveLength(2);
      expect(descendants).toContain(parent);
      expect(descendants).toContain(child);
    });
  });
});
