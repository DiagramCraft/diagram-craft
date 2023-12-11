import { EventEmitter } from '../utils/event.ts';
import { Box } from '../geometry/box.ts';
import { DiagramElement } from '../model-viewer/diagramNode.ts';
import { precondition } from '../utils/assert.ts';
import { SelectionState } from './selectionState.ts';

export type MarqueeEvents = {
  change: { marquee: Marquee };
};

export class Marquee extends EventEmitter<MarqueeEvents> {
  #bounds?: Box;

  pendingElements?: DiagramElement[];

  constructor(private readonly selectionState: SelectionState) {
    super();
  }

  set bounds(bounds: Box | undefined) {
    this.#bounds = bounds;
    this.emitAsync('change', { marquee: this });
  }

  get bounds(): Box | undefined {
    return this.#bounds;
  }

  clear() {
    this.bounds = undefined;
    this.pendingElements = undefined;
  }

  commitSelection() {
    precondition.is.present(this.pendingElements);

    this.selectionState.setElements([
      ...this.pendingElements.filter(e => !this.selectionState.elements.includes(e)),
      ...this.selectionState.elements
    ]);

    this.clear();
  }
}
