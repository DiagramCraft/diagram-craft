import { beforeEach, describe, expect, test } from 'vitest';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { DocumentBuilder } from '@diagram-craft/model/test-support/builder';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';

class TestAction extends AbstractSelectionAction {
  public constructor(
    protected readonly context: ActionContext,
    protected readonly multipleType: MultipleType,
    protected readonly elementType: ElementType = 'both'
  ) {
    super(context, multipleType, elementType);
    this.bindCriteria();
  }

  execute() {
    return;
  }
}

const mkContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('abstractSelectionAction', () => {
  describe('isEnabled', () => {
    const diagram = new DocumentBuilder().newDiagram();
    const layer = diagram.newLayer();
    const el1 = layer.addNode('1', 'rect', {});
    const el2 = layer.addNode('2', 'rect', {});
    const edge1 = layer.addEdge('e1');

    beforeEach(() => {
      diagram.selectionState.setElements([]);
    });

    describe('MultipleType', () => {
      test('should be disabled if no elements selected regardless of MultipleType', () => {
        expect(new TestAction(mkContext(diagram), MultipleType.Both).isEnabled(undefined)).toBe(
          false
        );
        expect(
          new TestAction(mkContext(diagram), MultipleType.SingleOnly).isEnabled(undefined)
        ).toBe(false);
        expect(
          new TestAction(mkContext(diagram), MultipleType.MultipleOnly).isEnabled(undefined)
        ).toBe(false);
      });

      test('should be enabled if elements selected and MultipleType is Both', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.Both);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([el1, el2]);
        expect(action.isEnabled(undefined)).toBe(true);
      });

      test('should be enabled if elements selected and MultipleType is SingleOnly', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.SingleOnly);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([el1, el2]);
        expect(action.isEnabled(undefined)).toBe(false);
      });

      test('should be enabled if elements selected and MultipleType is MultipleOnly', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.MultipleOnly);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1, el2]);
        expect(action.isEnabled(undefined)).toBe(true);
      });
    });

    describe('ElementType', () => {
      test('should be disabled if no elements selected regardless of ElementType', () => {
        expect(
          new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Both).isEnabled(
            undefined
          )
        ).toBe(false);
        expect(
          new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Node).isEnabled(
            undefined
          )
        ).toBe(false);
        expect(
          new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Edge).isEnabled(
            undefined
          )
        ).toBe(false);
      });

      test('should be enabled if elements selected and ElementType is Both', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Both);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([edge1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([el1, edge1]);
        expect(action.isEnabled(undefined)).toBe(true);
      });

      test('should be enabled if elements selected and ElementType is Node', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Node);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([edge1]);
        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1, edge1]);
        expect(action.isEnabled(undefined)).toBe(true);
      });

      test('should be enabled if elements selected and ElementType is Edge', () => {
        const action = new TestAction(mkContext(diagram), MultipleType.Both, ElementType.Edge);

        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([el1]);
        expect(action.isEnabled(undefined)).toBe(false);

        diagram.selectionState.setElements([edge1]);
        expect(action.isEnabled(undefined)).toBe(true);

        diagram.selectionState.setElements([el1, edge1]);
        expect(action.isEnabled(undefined)).toBe(true);
      });
    });
  });
});
