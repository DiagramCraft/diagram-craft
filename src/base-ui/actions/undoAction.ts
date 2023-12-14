import { Action, ActionEvents } from '../keyMap.ts';
import { Diagram } from '../../model-viewer/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';

declare global {
  interface ActionMap {
    UNDO: UndoAction;
  }
}

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
