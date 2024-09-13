import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface ActionMap extends ReturnType<typeof undoActions> {}
}

export const undoActions = (state: ActionConstructionParameters) => ({
  UNDO: new UndoAction(state.diagram)
});

export class UndoAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
    const cb = () => {
      this.enabled = this.diagram.undoManager.undoableActions.length > 0;
      this.emit('actionchanged', {});
    };
    this.diagram.undoManager.on('change', cb);
  }

  execute(): void {
    this.diagram.undoManager.undo();
    this.emit('actiontriggered', {});
  }
}
