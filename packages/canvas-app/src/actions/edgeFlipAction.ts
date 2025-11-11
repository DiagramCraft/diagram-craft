import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';

export const edgeFlipActions = (application: ActionContext) => ({
  EDGE_FLIP: new EdgeFlipAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMap extends ReturnType<typeof edgeFlipActions> {}
  }
}

export class EdgeFlipAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Edge);
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    for (const edge of this.context.model.activeDiagram.selection.edges) {
      edge.flip(uow);
    }

    commitWithUndo(uow, 'Flip edge');
  }
}
