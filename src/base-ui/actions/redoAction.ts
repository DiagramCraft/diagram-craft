import { Action, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    REDO: RedoAction;
  }
}

export const redoActions: ActionMapFactory = (state: State) => ({
  REDO: new RedoAction(state.diagram)
});

export class RedoAction extends EventEmitter<ActionEvents> implements Action {
  enabled = false;

  constructor(private readonly diagram: Diagram) {
    super();
    const cb = () => {
      this.enabled = this.diagram.undoManager.redoableActions.length > 0;
      this.emit('actionchanged', { action: this });
    };
    this.diagram.undoManager.on('change', cb);
  }

  execute(): void {
    this.diagram.undoManager.redo();
    this.emit('actiontriggered', { action: this });
  }
}
