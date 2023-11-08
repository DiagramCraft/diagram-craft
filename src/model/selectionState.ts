import { ResolvedNodeDef } from './diagram.ts';
import { Box } from '../geometry/geometry.ts';
import { precondition } from '../utils/assert.ts';
import { EventEmitter } from '../utils/event.ts';

const EMPTY_BOX = {
  pos: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
  size: { w: 0, h: 0 },
  rotation: 0
};

type SelectionSource = {
  elements: Box[];
  boundingBox: Box;
};

export class SelectionState extends EventEmitter<{
  change: { selection: SelectionState };
}> {
  private _bounds: Box;
  private _marquee?: Box;

  elements: ResolvedNodeDef[] = [];

  source: SelectionSource = {
    elements: [],
    boundingBox: EMPTY_BOX
  };

  pendingElements?: ResolvedNodeDef[];

  constructor() {
    super();
    this._bounds = EMPTY_BOX;
    this.elements = [];
  }

  get bounds(): Box {
    return this._bounds;
  }

  set bounds(bounds: Box) {
    this._bounds = bounds;
    this.emit('change', { selection: this });
  }

  get marquee(): Box | undefined {
    return this._marquee;
  }

  set marquee(marquee: Box | undefined) {
    this._marquee = marquee;
    this.emit('change', { selection: this });
  }

  isChanged(): boolean {
    return this.elements.some((node, i) => {
      const original = this.source.elements[i];
      return !Box.equals(node.bounds, original);
    });
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  recalculateBoundingBox() {
    this._bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.elements.map(e => e.bounds));
    this.emit('change', { selection: this });
  }

  recalculateSourceBoundingBox() {
    this.source.boundingBox =
      this.source.elements.length === 0 ? EMPTY_BOX : Box.boundingBox(this.source.elements);
  }

  toggle(element: ResolvedNodeDef) {
    this.elements = this.elements.includes(element)
      ? this.elements.filter(e => e !== element)
      : [...this.elements, element];
    this.source.elements = this.elements.map(e => e.bounds);

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();
  }

  clear() {
    this.elements = [];
    this.source.elements = [];
    this._marquee = undefined;
    this.pendingElements = undefined;

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();
  }

  setPendingElements(pendingElemenets: ResolvedNodeDef[]) {
    this.pendingElements = pendingElemenets;
  }

  convertMarqueeToSelection() {
    precondition.is.present(this.pendingElements);

    for (const e of this.pendingElements) {
      if (!this.elements.includes(e)) this.toggle(e);
    }

    this.recalculateSourceBoundingBox();
    this.recalculateBoundingBox();

    this.pendingElements = undefined;

    this.marquee = undefined;
  }

  rebaseline() {
    this.source.elements = this.elements.map(e => e.bounds);
    this.recalculateSourceBoundingBox();

    this.emit('change', { selection: this });
  }
}
