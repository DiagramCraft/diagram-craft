import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

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
