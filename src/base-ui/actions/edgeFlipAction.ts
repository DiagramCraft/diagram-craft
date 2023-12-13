import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';

declare global {
  interface ActionMap {
    EDGE_FLIP: EdgeFlipAction;
  }
}

export class EdgeFlipAction extends EventEmitter<ActionEvents> implements Action {
  enabled = false;

  constructor(private readonly diagram: EditableDiagram) {
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
    for (const edge of this.diagram.selectionState.edges) {
      edge.flip();
      this.diagram.updateElement(edge);
    }
  }
}
