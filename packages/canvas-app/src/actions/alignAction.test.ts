import { beforeEach, describe, expect, test } from 'vitest';
import { AlignAction } from './alignAction';
import {
  TestDiagramBuilder,
  TestDocumentBuilder,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/builder';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';

const mkContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('AlignActions', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = new TestDocumentBuilder().newDiagram();
    layer = diagram.newLayer();
    layer.addNode('1', 'rect', {
      bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 }
    });
    layer.addNode('2', 'rect', {
      bounds: { x: 20, y: 20, w: 70, h: 150, r: 0 }
    });
    layer.addNode('3', 'rect', {
      bounds: { x: 10, y: 5, w: 100, h: 60, r: 0 }
    });
  });

  describe('enabled', () => {
    test('should not be enabled when there the selection is only one or empty', () => {
      diagram.selectionState.setElements([]);
      const action1 = new AlignAction('top', mkContext(diagram));
      action1.bindCriteria();
      expect(action1.isEnabled(undefined)).toBe(false);

      diagram.selectionState.setElements([layer.elements[0]]);
      const action2 = new AlignAction('top', mkContext(diagram));
      action2.bindCriteria();
      expect(action2.isEnabled(undefined)).toBe(false);
    });

    test('should be enabled when there are more than one element selected', () => {
      diagram.selectionState.setElements(layer.elements);
      const action = new AlignAction('top', mkContext(diagram));
      action.bindCriteria();
      expect(action.isEnabled(undefined)).toBe(true);
    });
  });

  describe('align', () => {
    test('should align the selected elements to the top', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('top', mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(10);
      expect(e3.bounds.y).toBe(10);
    });

    test('should align the selected elements to the bottom', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('bottom', mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(-40);
      expect(e3.bounds.y).toBe(50);
    });

    test('should align the selected elements to the center-horizontal', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('center-horizontal', mkContext(diagram)).execute();
      expect(e1.bounds.y).toBe(10);
      expect(e2.bounds.y).toBe(-15);
      expect(e3.bounds.y).toBe(30);
    });

    test('should align the selected elements to the left', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('left', mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(10);
      expect(e3.bounds.x).toBe(10);
    });

    test('should align the selected elements to the right', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('right', mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(40);
      expect(e3.bounds.x).toBe(10);
    });

    test('should align the selected elements to the center-vertical', () => {
      const [e1, e2, e3] = layer.elements;
      diagram.selectionState.setElements([e1, e2, e3]);

      new AlignAction('center-vertical', mkContext(diagram)).execute();
      expect(e1.bounds.x).toBe(10);
      expect(e2.bounds.x).toBe(25);
      expect(e3.bounds.x).toBe(10);
    });
  });
});
