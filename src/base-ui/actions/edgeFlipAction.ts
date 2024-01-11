import { Action, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface ActionMap {
    EDGE_FLIP: EdgeFlipAction;
  }
}

export const edgeFlipActions: ActionMapFactory = (state: State) => ({
  EDGE_FLIP: new EdgeFlipAction(state.diagram)
});

export class EdgeFlipAction extends EventEmitter<ActionEvents> implements Action {
  enabled = false;

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
    // TODO: Implement undo
    const uow = new UnitOfWork(this.diagram);
    for (const edge of this.diagram.selectionState.edges) {
      edge.flip(uow);
    }
    uow.commit();
  }
}
