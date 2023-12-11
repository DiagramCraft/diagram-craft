import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';

declare global {
  interface ActionMap {
    SELECTION_RESTACK_UP: SelectionRestackAction;
    SELECTION_RESTACK_DOWN: SelectionRestackAction;
    SELECTION_RESTACK_BOTTOM: SelectionRestackAction;
    SELECTION_RESTACK_TOP: SelectionRestackAction;
  }
}

export class SelectionRestackAction extends EventEmitter<ActionEvents> implements Action {
  // TODO: Only enable if there is a selection
  enabled = true;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly mode: 'up' | 'down' | 'top' | 'bottom' = 'up'
  ) {
    super();
  }

  // TODO: Add undo
  execute(): void {
    if (this.mode === 'up') {
      this.diagram.restack(this.diagram.selectionState.elements, 2);
    } else if (this.mode === 'down') {
      this.diagram.restack(this.diagram.selectionState.elements, -2);
    } else if (this.mode === 'top') {
      this.diagram.restack(this.diagram.selectionState.elements, this.diagram.elements.length);
    } else if (this.mode === 'bottom') {
      this.diagram.restack(this.diagram.selectionState.elements, -this.diagram.elements.length);
    }
    this.emit('actiontriggered', { action: this });
  }
}
