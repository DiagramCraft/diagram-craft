import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

export abstract class AbstractSelectionAction extends AbstractAction {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly multiple = false
  ) {
    super();

    this.addSelectionListener(() => {
      this.enabled =
        !this.diagram.selectionState.isEmpty() &&
        (!this.multiple || this.diagram.selectionState.elements.length > 1);
    });
  }

  protected addSelectionListener(cb: () => void) {
    this.diagram.selectionState.on('add', () => {
      cb();
      this.emit('actionchanged', { action: this });
    });
    this.diagram.selectionState.on('remove', () => {
      cb();
      this.emit('actionchanged', { action: this });
    });
    cb();
  }

  abstract execute(): void;
}
