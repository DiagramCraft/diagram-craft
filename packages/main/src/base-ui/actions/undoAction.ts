import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { AbstractAction } from '../action.ts';

declare global {
  interface ActionMap {
    UNDO: UndoAction;
  }
}

export const undoActions: ActionMapFactory = (state: State) => ({
  UNDO: new UndoAction(state.diagram)
});

export class UndoAction extends AbstractAction {
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
