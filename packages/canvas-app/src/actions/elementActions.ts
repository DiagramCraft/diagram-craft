import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { assert } from '@diagram-craft/utils/assert';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof elementActions> {}
  }
}

export const elementActions = (context: ActionContext) => ({
  ELEMENT_CONVERT_TO_NAME_ELEMENT: new ElementConvertToNameAction(context)
});

class ElementConvertToNameAction extends AbstractSelectionAction {
  name = $tStr('action.ELEMENT_CONVERT_TO_NAME_ELEMENT.name', 'Convert to named element');

  constructor(context: ActionContext) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: ActionContext): Array<ActionCriteria> {
    const baseCriteria = super.getCriteria(context);

    const callback = () => {
      const nodes = context.model.activeDiagram.selection.nodes;
      assert.arrayWithExactlyOneElement(nodes);

      const node = nodes[0]!;

      // Action should not be available if:
      // 1. Primary text is already '%name%'
      // 2. Name property is already set
      if (node.getText() === '%name%') return false;
      if (!isEmptyString(node.metadata.name)) return false;

      return true;
    };

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.undoManager, 'execute', callback)
    ];
  }

  execute(): void {
    const node = this.context.model.activeDiagram.selection.nodes[0]!;
    const primaryText = node.getText();

    UnitOfWork.executeWithUndo(
      this.context.model.activeDiagram,
      'Convert to named element',
      uow => {
        node.updateMetadata(metadata => (metadata.name = primaryText), uow);
        node.setText('%name%', uow);
      }
    );
  }
}

export const _test = {
  ElementConvertToNameAction
};
