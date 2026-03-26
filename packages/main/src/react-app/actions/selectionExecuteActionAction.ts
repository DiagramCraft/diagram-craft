import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { $tStr } from '@diagram-craft/utils/localize';
import {
  createNodeActionChooserDialog,
  executeNodeAction,
  getExecutableActionsForNode,
  isNodeActionable
} from '../nodeActionUtils';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionExecuteActionActions> {}
  }
}

export const selectionExecuteActionActions = (context: Application) => ({
  SELECTION_EXECUTE_ACTION: new SelectionExecuteAction(context)
});

export class SelectionExecuteAction extends AbstractSelectionAction<Application, { id?: string }> {
  name = $tStr('action.SELECTION_EXECUTE_ACTION.name', 'Act');

  constructor(context: Application) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Application) {
    return [
      ...super.getCriteria(context),
      ActionCriteria.Simple(() => {
        return context.model.activeDiagram.selection.elements.every(e => {
          return isNode(e) && isNodeActionable(e);
        });
      })
    ];
  }

  execute(arg: { id?: string }): void {
    const diagram = this.context.model.activeDiagram;

    let node: DiagramNode;
    if (arg?.id) {
      const n = diagram.nodeLookup.get(arg?.id);
      assert.present(n);

      node = n;
    } else {
      assert.arrayWithExactlyOneElement(diagram.selection.nodes);

      node = diagram.selection.nodes[0];
    }

    const actions = getExecutableActionsForNode(node);
    if (actions.length === 0) return;

    if (actions.length === 1) {
      executeNodeAction(this.context, actions[0]!);
      return;
    }

    this.context.ui.showDialog(
      createNodeActionChooserDialog(
        {
          title: 'Choose Action',
          actions
        },
        action => executeNodeAction(this.context, action)
      )
    );
  }
}
