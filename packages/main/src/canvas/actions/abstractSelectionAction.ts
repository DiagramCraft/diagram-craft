import { Diagram } from '@diagram-craft/model';
import { AbstractAction } from '../../canvas/action.ts';

export abstract class AbstractSelectionAction extends AbstractAction {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly multiple = false
  ) {
    super();
    const cb = () => {
      this.enabled =
        !this.diagram.selectionState.isEmpty() &&
        (!this.multiple || this.diagram.selectionState.elements.length > 1);
      this.emit('actionchanged', { action: this });
    };
    this.diagram.selectionState.on('add', cb);
    this.diagram.selectionState.on('remove', cb);
    cb();
  }

  abstract execute(): void;
}
