import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';

export const edgeFlipActions = (application: ActionContext) => ({
  EDGE_FLIP: new EdgeFlipAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof edgeFlipActions> {}
  }
}

export class EdgeFlipAction extends AbstractSelectionAction {
  name = $tStr('action.EDGE_FLIP.name', 'Flip edge');

  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Edge);
  }

  execute(): void {
    this.context.model.activeDiagram.undoManager.execute('Flip edge', uow => {
      for (const edge of this.context.model.activeDiagram.selection.edges) {
        edge.flip(uow);
      }
    });
  }
}
