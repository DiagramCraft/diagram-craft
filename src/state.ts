import { ResolvedNodeDef } from './model/diagram.ts';
import { Box, Point } from './geometry.ts';

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

export class SelectionState implements Box {
  pos: Box['pos'];
  size: Box['size'];
  rotation: Box['rotation'];

  elements: ResolvedNodeDef[] = [];

  source: SelectionSource = {
    elements: [],
    boundingBox: Box.snapshot(EMPTY_BOX)
  };

  marquee?: Box;
  pendingElements?: ResolvedNodeDef[];

  constructor() {
    this.pos = EMPTY_BOX.pos;
    this.size = EMPTY_BOX.size;
    this.rotation = EMPTY_BOX.rotation;
    this.elements = [];
  }

  recalculateBoundingBox() {
    const bb = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.elements.map(e => e.bounds));
    this.pos = bb.pos;
    this.size = bb.size;
    this.rotation = bb.rotation;
  }

  recalculateSourceBoundingBox() {
    const sourcebb =
      this.source.elements.length === 0 ? EMPTY_BOX : Box.boundingBox(this.source.elements);
    this.source.boundingBox.pos = sourcebb.pos;
    this.source.boundingBox.size = sourcebb.size;
    this.source.boundingBox.rotation = sourcebb.rotation;
  }

  toggle(element: ResolvedNodeDef) {
    this.rotation = 0;

    this.elements = this.elements.includes(element)
      ? this.elements.filter(e => e !== element)
      : [...this.elements, element];
    this.source.elements = this.elements.map(e => Box.snapshot(e.bounds));

    this.recalculateBoundingBox();
    this.recalculateSourceBoundingBox();
  }

  clear() {
    this.rotation = 0;
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

  clearMarquee() {
    this.marquee = undefined;
    this.pendingElements = undefined;
  }

  rebaseline() {
    this.source.elements = this.elements.map(e => Box.snapshot(e.bounds));
    this.recalculateSourceBoundingBox();
  }
}
