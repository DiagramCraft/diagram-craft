import { Action, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    UNDO: UndoAction;
  }
}

export const undoActions: ActionMapFactory = (state: State) => ({
  UNDO: new UndoAction(state.diagram)
});

export class UndoAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
    const cb = () => {
      this.enabled = this.diagram.undoManager.undoableActions.length > 0;
      this.emit('actionchanged', { action: this });
    };
    this.diagram.undoManager.on('change', cb);
  }

  execute(): void {
    this.diagram.undoManager.undo();
    this.emit('actiontriggered', { action: this });
  }
}
