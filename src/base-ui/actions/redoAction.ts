import { Action, ActionEvents } from '../keyMap.ts';
import { Diagram } from '../../model-viewer/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';

declare global {
  interface ActionMap {
    REDO: RedoAction;
  }
}

export class RedoAction extends EventEmitter<ActionEvents> implements Action {
  enabled = false;

  constructor(private readonly diagram: Diagram) {
    super();
    const cb = () => {
      this.enabled = this.diagram.undoManager.redoableActions.length > 0;
      this.emit('actionchanged', { action: this });
    };
    this.diagram.undoManager.on('undo', cb);
    this.diagram.undoManager.on('redo', cb);
    this.diagram.undoManager.on('add', cb);
    this.diagram.undoManager.on('execute', cb);
  }

  execute(): void {
    this.diagram.undoManager.redo();
    this.emit('actiontriggered', { action: this });
  }
}
