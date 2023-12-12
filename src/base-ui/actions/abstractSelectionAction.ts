import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { Action, ActionEvents } from '../keyMap.ts';

export abstract class AbstractSelectionAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  protected constructor(protected readonly diagram: EditableDiagram) {
    super();
    const cb = () => {
      this.enabled = !this.diagram.selectionState.isEmpty();
      this.emit('actionchanged', { action: this });
    };
    this.diagram.selectionState.on('add', cb);
    this.diagram.selectionState.on('remove', cb);
    cb();
  }

  abstract execute(): void;
}
