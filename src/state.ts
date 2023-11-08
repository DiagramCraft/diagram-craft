import { ResolvedNodeDef } from './model/diagram.ts';
import { Box, Point } from './geometry.ts';
import { precondition } from './assert.ts';

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

export class SelectionState {
  bounds: Box;

  elements: ResolvedNodeDef[] = [];

  source: SelectionSource = {
    elements: [],
    boundingBox: EMPTY_BOX
  };

  marquee?: Box;
  pendingElements?: ResolvedNodeDef[];

  constructor() {
    this.bounds = EMPTY_BOX;
    this.elements = [];
  }

  isChanged(): boolean {
    return this.elements.some((node, i) => {
      const original = this.source.elements[i];
      return !Box.equals(node.bounds, original);
    });
  }

  recalculateBoundingBox() {
    this.bounds = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.elements.map(e => e.bounds));
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

    this.recalculateBoundingBox();
    this.recalculateSourceBoundingBox();
  }

  clear() {
    this.elements = [];
    this.source.elements = [];
    this.marquee = undefined;
    this.pendingElements = undefined;
    this.recalculateBoundingBox();
    this.recalculateSourceBoundingBox();
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  convertMarqueeToSelection() {
    precondition.is.present(this.pendingElements);

    this.elements = this.pendingElements;
    this.source.elements = this.pendingElements.map(e => e.bounds);

    this.recalculateBoundingBox();
    this.recalculateSourceBoundingBox();

    this.marquee = undefined;
    this.pendingElements = undefined;
  }

  rebaseline() {
    this.source.elements = this.elements.map(e => e.bounds);
    this.recalculateSourceBoundingBox();
  }
}
