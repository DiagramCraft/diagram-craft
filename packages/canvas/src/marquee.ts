import { DiagramElement } from '@diagram-craft/model/diagramElement';
import type { Selection } from '@diagram-craft/model/selection';
import { Box } from '@diagram-craft/geometry/box';
import { EventEmitter } from '@diagram-craft/utils/event';
import { precondition } from '@diagram-craft/utils/assert';

export type MarqueeEvents = {
  change: { marquee: Marquee };
};

export class Marquee extends EventEmitter<MarqueeEvents> {
  #bounds?: Box;

  pendingElements?: ReadonlyArray<DiagramElement>;

  set bounds(bounds: Box | undefined) {
    this.#bounds = bounds;
    this.emitAsyncWithDebounce('change', { marquee: this });
  }

  get bounds(): Box | undefined {
    return this.#bounds;
  }

  clear() {
    this.bounds = undefined;
    this.pendingElements = undefined;
  }

  commitSelection(selection: Selection) {
    precondition.is.present(this.pendingElements);

    selection.setElements([
      ...this.pendingElements.filter(e => !selection.elements.includes(e)),
      ...selection.elements
    ]);

    this.clear();
  }
}
