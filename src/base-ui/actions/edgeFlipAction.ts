import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { AbstractAction } from '../action.ts';

declare global {
  interface ActionMap {
    EDGE_FLIP: EdgeFlipAction;
  }
}

export const edgeFlipActions: ActionMapFactory = (state: State) => ({
  EDGE_FLIP: new EdgeFlipAction(state.diagram)
});

export class EdgeFlipAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
    const cb = () => {
      this.enabled = this.diagram.selectionState.isEdgesOnly();
      this.emit('actionchanged', { action: this });
    };
    this.diagram.selectionState.on('add', cb);
    this.diagram.selectionState.on('remove', cb);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);
    for (const edge of this.diagram.selectionState.edges) {
      edge.flip(uow);
    }

    commitWithUndo(uow, 'Flip edge');
  }
}
