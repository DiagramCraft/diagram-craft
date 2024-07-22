import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

type MultipleType = 'single-only' | 'multiple-only' | 'both';
type ElementType = 'node' | 'edge' | 'both';

export abstract class AbstractSelectionAction extends AbstractAction {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly multipleType: MultipleType,
    protected readonly elementType: ElementType = 'both'
  ) {
    super();

    this.addSelectionListener(() => {
      const $s = this.diagram.selectionState;
      if ($s.isEmpty()) {
        this.enabled = false;
        return;
      }

      const elements =
        this.elementType === 'both'
          ? $s.elements
          : this.elementType === 'edge'
            ? $s.edges
            : $s.nodes;

      if (elements.length === 0) {
        this.enabled = false;
        return;
      }

      if (this.multipleType === 'single-only' && elements.length > 1) {
        this.enabled = false;
        return;
      }

      if (this.multipleType === 'multiple-only' && elements.length === 1) {
        this.enabled = false;
        return;
      }

      this.enabled = true;
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
