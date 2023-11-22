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
    this.diagram.undoManager.on('*', () => {
      this.enabled = this.diagram.undoManager.redoableActions.length > 0;
      this.emit('actionchanged', { action: this });
    });
  }

  execute(): void {
    this.diagram.undoManager.redo();
    this.emit('actiontriggered', { action: this });
  }
}
