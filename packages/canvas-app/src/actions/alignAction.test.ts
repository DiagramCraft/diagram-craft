import { beforeEach, describe, expect, test } from 'vitest';
import { AlignAction, DimensionAlignAction } from './alignAction';
import {
  TestDiagramBuilder,
  TestModel,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
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

describe('AlignActions', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
    layer.addNode({ bounds: { x: 20, y: 20, w: 70, h: 150, r: 0 } });
    layer.addNode({ bounds: { x: 10, y: 5, w: 100, h: 60, r: 0 } });
  });

  describe('enabled', () => {
    test('should not be enabled when there the selection is only one or empty', () => {
      diagram.selection.setElements([]);
      const action1 = new AlignAction('top', $tStr('', ''), mkContext(diagram));
      action1.bindCriteria();
      expect(action1.isEnabled(undefined)).toBe(false);

      diagram.selection.setElements([layer.elements[0]!]);
      const action2 = new AlignAction('top', $tStr('', ''), mkContext(diagram));
      action2.bindCriteria();
      expect(action2.isEnabled(undefined)).toBe(false);
    });

    test('should be enabled when there are more than one element selected', () => {
      diagram.selection.setElements(layer.elements);
      const action = new AlignAction('top', $tStr('', ''), mkContext(diagram));
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
      const action = new AlignAction('top', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(true);
    });

    test('should not be enabled when a single node with only 1 child is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => parent.addChild(child1, uow));

      diagram.selection.setElements([parent]);
      const action = new AlignAction('top', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(false);
    });

    test('should not be enabled when a single node with no children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });

      diagram.selection.setElements([parent]);
      const action = new AlignAction('top', $tStr('', ''), mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(false);
    });
  });

  describe('align', () => {
    test('should align the selected elements to the top', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('top', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(10);
      expect(e3.bounds.y).toBe(10);
    });

    test('should align the selected elements to the bottom', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('bottom', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(-40);
      expect(e3.bounds.y).toBe(50);
    });

    test('should align the selected elements to the center-horizontal', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('center-horizontal', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(-15);
      expect(e3.bounds.y).toBe(30);
    });

    test('should align the selected elements to the left', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('left', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(10);
      expect(e3.bounds.x).toBe(10);
    });

    test('should align the selected elements to the right', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('right', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(40);
      expect(e3.bounds.x).toBe(10);
    });

    test('should align the selected elements to the center-vertical', () => {
      const [e1, e2, e3] = layer.elements as [DiagramElement, DiagramElement, DiagramElement];
      diagram.selection.setElements([e1, e2, e3]);

      new AlignAction('center-vertical', $tStr('', ''), mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(25);
      expect(e3.bounds.x).toBe(10);
    });
  });

  describe('align children of single node', () => {
    test('should align children to the top when single node with children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 20, y: 30, w: 50, h: 60, r: 0 } });
      const child3 = layer.addNode({ bounds: { x: 30, y: 15, w: 50, h: 40, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
        parent.addChild(child3, uow);
      });

      diagram.selection.setElements([parent]);
      new AlignAction('top', $tStr('', ''), mkContext(diagram)).execute();

      expect(child1.bounds.y).toBe(10);
      expect(child2.bounds.y).toBe(10);
      expect(child3.bounds.y).toBe(10);
    });

    test('should align children to the left when single node with children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 30, y: 20, w: 60, h: 50, r: 0 } });
      const child3 = layer.addNode({ bounds: { x: 15, y: 30, w: 40, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
        parent.addChild(child3, uow);
      });

      diagram.selection.setElements([parent]);
      new AlignAction('left', $tStr('', ''), mkContext(diagram)).execute();

      expect(child1.bounds.x).toBe(10);
      expect(child2.bounds.x).toBe(10);
      expect(child3.bounds.x).toBe(10);
    });

    test('should align children to the center-vertical when single node with children is selected', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 30, y: 20, w: 60, h: 50, r: 0 } });

      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
      });

      diagram.selection.setElements([parent]);
      new AlignAction('center-vertical', $tStr('', ''), mkContext(diagram)).execute();

      // child1: center at 10 + 50/2 = 35
      // child2: center should be at 35, so x = 35 - 60/2 = 5
      expect(child1.bounds.x).toBe(10);
      expect(child2.bounds.x).toBe(5);
    });
  });
});

describe('DimensionAlignAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  describe('align width', () => {
    test('should align width of all selected elements to the first element', () => {
      const e1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 50, r: 0 } });
      const e2 = layer.addNode({ bounds: { x: 20, y: 20, w: 70, h: 60, r: 0 } });
      const e3 = layer.addNode({ bounds: { x: 30, y: 30, w: 150, h: 40, r: 0 } });

      diagram.selection.setElements([e1, e2, e3]);
      new DimensionAlignAction('width', $tStr('', ''), mkContext(diagram)).execute();

      expect(e1.bounds.w).toBe(100);
      expect(e2.bounds.w).toBe(100);
      expect(e3.bounds.w).toBe(100);

      // Verify positions haven't changed
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(20);
      expect(e3.bounds.x).toBe(30);

      // Verify heights haven't changed
      expect(e1.bounds.h).toBe(50);
      expect(e2.bounds.h).toBe(60);
      expect(e3.bounds.h).toBe(40);
    });
  });

  describe('align height', () => {
    test('should align height of all selected elements to the first element', () => {
      const e1 = layer.addNode({ bounds: { x: 10, y: 10, w: 50, h: 100, r: 0 } });
      const e2 = layer.addNode({ bounds: { x: 20, y: 20, w: 60, h: 70, r: 0 } });
      const e3 = layer.addNode({ bounds: { x: 30, y: 30, w: 40, h: 150, r: 0 } });

      diagram.selection.setElements([e1, e2, e3]);
      new DimensionAlignAction('height', $tStr('', ''), mkContext(diagram)).execute();

      expect(e1.bounds.h).toBe(100);
      expect(e2.bounds.h).toBe(100);
      expect(e3.bounds.h).toBe(100);

      // Verify positions haven't changed
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(20);
      expect(e3.bounds.y).toBe(30);

      // Verify widths haven't changed
      expect(e1.bounds.w).toBe(50);
      expect(e2.bounds.w).toBe(60);
      expect(e3.bounds.w).toBe(40);
    });
  });
});
