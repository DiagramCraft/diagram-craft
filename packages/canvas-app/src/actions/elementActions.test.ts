import { describe, test, expect } from 'vitest';
import { _test } from './elementActions';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionContext } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

const { ElementConvertToNameAction } = _test;

const mkContext = (d: Diagram): ActionContext => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('ElementConvertToNameElementAction', () => {
  test('should convert node text to name property', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const node = layer.addNode();
    const uow = UnitOfWork.immediate(diagram);

    node.setText('My Node Text', uow);
    diagram.selection.setElements([node]);

    const action = new ElementConvertToNameAction(mkContext(diagram));
    action.execute();

    expect(node.metadata.name).toBe('My Node Text');
    expect(node.getText()).toBe('%name%');
    expect(node.name).toBe('My Node Text');
  });

  test('should not be available when text is already %name%', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const node = layer.addNode();
    const uow = UnitOfWork.immediate(diagram);

    node.setText('%name%', uow);
    node.updateMetadata(metadata => {
      metadata.name = 'Some Name';
    }, uow);
    diagram.selection.setElements([node]);

    const action = new ElementConvertToNameAction(mkContext(diagram));
    action.bindCriteria();
    expect(action.isEnabled(undefined)).toBe(false);
  });

  test('should not be available when name is already set', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const node = layer.addNode();
    const uow = UnitOfWork.immediate(diagram);

    node.setText('Some Text', uow);
    node.updateMetadata(metadata => {
      metadata.name = 'Existing Name';
    }, uow);
    diagram.selection.setElements([node]);

    const action = new ElementConvertToNameAction(mkContext(diagram));
    action.bindCriteria();
    expect(action.isEnabled(undefined)).toBe(false);
  });
});
