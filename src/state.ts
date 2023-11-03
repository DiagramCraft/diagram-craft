import { ResolvedNodeDef } from './diagram.ts';
import { Box, Point } from './geometry.ts';

export type ObjectDrag = {
  type:
    | 'move'
    | 'resize-nw'
    | 'resize-ne'
    | 'resize-sw'
    | 'resize-se'
    | 'resize-n'
    | 'resize-s'
    | 'resize-w'
    | 'resize-e'
    | 'rotate';
  offset: Point;
  original: Box;
};

export type Drag =
  | ObjectDrag
  | {
      type: 'marquee';
      offset: Point;
    };

const EMPTY_BOX = {
  pos: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
  size: { w: 0, h: 0 },
  rotation: undefined
};

export class SelectionState implements Box {
  pos: Box['pos'];
  size: Box['size'];
  rotation: Box['rotation'];

  elements: ResolvedNodeDef[] = [];

  marquee?: Box;
  pendingElements?: ResolvedNodeDef[];

  constructor() {
    this.pos = EMPTY_BOX.pos;
    this.size = EMPTY_BOX.size;
    this.rotation = EMPTY_BOX.rotation;
    this.elements = [];
  }

  recalculateBoundingBox() {
    const bb = this.isEmpty() ? EMPTY_BOX : Box.boundingBox(this.elements);
    this.pos = bb.pos;
    this.size = bb.size;
    this.rotation ??= bb.rotation;
  }

  toggle(element: ResolvedNodeDef) {
    this.rotation = undefined;

    this.elements = this.elements.includes(element)
      ? this.elements.filter(e => e !== element)
      : [...this.elements, element];
    this.recalculateBoundingBox();
  }

  clear() {
    this.rotation = undefined;
    this.elements = [];
    this.marquee = undefined;
    this.pendingElements = undefined;
    this.recalculateBoundingBox();
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  clearMarquee() {
    this.marquee = undefined;
    this.pendingElements = undefined;
  }
}
