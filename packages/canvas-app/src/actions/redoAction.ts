import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/index';
import { AbstractAction } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap {
    REDO: RedoAction;
  }
}

export const redoActions: ActionMapFactory = (state: State) => ({
  REDO: new RedoAction(state.diagram)
});

export class RedoAction extends AbstractAction {
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
