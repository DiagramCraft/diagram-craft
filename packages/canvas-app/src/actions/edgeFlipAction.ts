import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';

export const edgeFlipActions = (state: ActionConstructionParameters) => ({
  EDGE_FLIP: new EdgeFlipAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof edgeFlipActions> {}
}

export class EdgeFlipAction extends AbstractSelectionAction {
  constructor(diagram: Diagram) {
    super(diagram, MultipleType.Both, ElementType.Edge);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);
    for (const edge of this.diagram.selectionState.edges) {
      edge.flip(uow);
    }

    commitWithUndo(uow, 'Flip edge');
  }
}
