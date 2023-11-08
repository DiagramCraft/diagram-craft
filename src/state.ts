import { ResolvedNodeDef } from './model/diagram.ts';
import { Box, Point } from './geometry.ts';
import { precondition } from './assert.ts';
import { EventEmitter } from './model/event.ts';

export type ResizeDrag = {
  type:
    | 'resize-nw'
    | 'resize-ne'
    | 'resize-sw'
    | 'resize-se'
    | 'resize-n'
    | 'resize-s'
    | 'resize-w'
    | 'resize-e';
  offset: Point;
};

export const isResizeDrag = (drag: Drag | undefined): drag is ResizeDrag => {
  if (!drag) return false;
  return (
    drag.type === 'resize-se' ||
    drag.type === 'resize-sw' ||
    drag.type === 'resize-ne' ||
    drag.type === 'resize-nw' ||
    drag.type === 'resize-n' ||
    drag.type === 'resize-s' ||
    drag.type === 'resize-e' ||
    drag.type === 'resize-w'
  );
};

export type MoveDrag = {
  type: 'move';
  offset: Point;
};

export type RotateDrag = {
  type: 'rotate';
  offset: Point;
};

type MarqueeDrag = {
  type: 'marquee';
  offset: Point;
};

export type Drag = ResizeDrag | MoveDrag | RotateDrag | MarqueeDrag;

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

    this.elements = this.pendingElements;
    this.source.elements = this.pendingElements.map(e => e.bounds);

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
