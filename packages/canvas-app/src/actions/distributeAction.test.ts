import { beforeEach, describe, expect, test } from 'vitest';
import { DistributeAction } from './distributeAction';
import {
  TestDiagramBuilder,
  TestLayerBuilder,
  TestModel
} from '@diagram-craft/model/test-support/testModel';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const mkContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('DistributeAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  describe('enabled', () => {
    test('should not be enabled when the selection is empty or has only one element', () => {
      diagram.selection.setElements([]);
      const action1 = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action1.bindCriteria();
      expect(action1.isEnabled(undefined)).toBe(false);

      const node = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      diagram.selection.setElements([node]);
      const action2 = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action2.bindCriteria();
      expect(action2.isEnabled(undefined)).toBe(false);
    });

    test('should be enabled when there are more than one element selected', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 20, y: 20, w: 70, h: 150, r: 0 } });
      diagram.selection.setElements([node1, node2]);
      const action = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(true);
    });

    test('should be enabled when a single node with at least 2 children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 20, y: 20, w: 50, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
      });

      diagram.selection.setElements([parent]);
      const action = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(true);
    });

    test('should not be enabled when a single node with only 1 child is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => parent.addChild(child1, uow));

      diagram.selection.setElements([parent]);
      const action = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(false);
    });

    test('should not be enabled when a single node with no children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });

      diagram.selection.setElements([parent]);
      const action = new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(false);
    });
  });

  describe('distribute', () => {
    test('should distribute elements horizontally', () => {
      const e1 = layer.addNode({ bounds: { x: 0, y: 10, w: 50, h: 100, r: 0 } });
      const e2 = layer.addNode({ bounds: { x: 200, y: 10, w: 50, h: 100, r: 0 } });
      const e3 = layer.addNode({ bounds: { x: 100, y: 10, w: 50, h: 100, r: 0 } });

      diagram.selection.setElements([e1, e2, e3]);
      new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram)).execute();

      // e1 should be at x=0 (leftmost)
      // e3 should be in the middle
      // e2 should be at x=200 (rightmost)
      expect(e1.bounds.x).toBe(0);
      expect(e3.bounds.x).toBe(100);
      expect(e2.bounds.x).toBe(200);
    });

    test('should distribute elements vertically', () => {
      const e1 = layer.addNode({ bounds: { x: 10, y: 0, w: 100, h: 50, r: 0 } });
      const e2 = layer.addNode({ bounds: { x: 10, y: 200, w: 100, h: 50, r: 0 } });
      const e3 = layer.addNode({ bounds: { x: 10, y: 100, w: 100, h: 50, r: 0 } });

      diagram.selection.setElements([e1, e2, e3]);
      new DistributeAction('vertical', $tStr('', ''), mkContext(diagram)).execute();

      // e1 should be at y=0 (topmost)
      // e3 should be in the middle
      // e2 should be at y=200 (bottommost)
      expect(e1.bounds.y).toBe(0);
      expect(e3.bounds.y).toBe(100);
      expect(e2.bounds.y).toBe(200);
    });
  });

  describe('distribute children of single node', () => {
    test('should distribute children horizontally when single node with children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 300, h: 100, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 0, y: 10, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 250, y: 10, w: 50, h: 50, r: 0 } });
      const child3 = layer.addNode({ bounds: { x: 100, y: 10, w: 50, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
        parent.addChild(child3, uow);
      });

      diagram.selection.setElements([parent]);
      new DistributeAction('horizontal', $tStr('', ''), mkContext(diagram)).execute();

      // Children should be evenly distributed
      expect(child1.bounds.x).toBe(0);
      expect(child3.bounds.x).toBe(125);
      expect(child2.bounds.x).toBe(250);
    });

    test('should distribute children vertically when single node with children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 100, h: 300, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 0, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 10, y: 250, w: 50, h: 50, r: 0 } });
      const child3 = layer.addNode({ bounds: { x: 10, y: 100, w: 50, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
        parent.addChild(child3, uow);
      });

      diagram.selection.setElements([parent]);
      new DistributeAction('vertical', $tStr('', ''), mkContext(diagram)).execute();

      // Children should be evenly distributed
      expect(child1.bounds.y).toBe(0);
      expect(child3.bounds.y).toBe(125);
      expect(child2.bounds.y).toBe(250);
    });
  });
});
