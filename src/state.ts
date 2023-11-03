import { ResolvedNodeDef } from './diagram.ts';
import { Coord, Box } from './geometry.ts';

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
  offset: Coord;
  original: Box;
};

export type Drag =
  | ObjectDrag
  | {
      type: 'marquee';
      offset: Coord;
    };

export interface SelectionState extends Box {
  elements: ResolvedNodeDef[];

  marquee?: Box;
  pendingElements?: ResolvedNodeDef[];
}

export const SelectionState = {
  update: (dest: SelectionState, elements: ResolvedNodeDef[]) => {
    dest.elements = elements;

    const bb = dest.elements.length === 0 ? SelectionState.EMPTY() : Box.boundingBox(elements);

    dest.pos = bb.pos;
    dest.size = bb.size;
    dest.rotation = dest.rotation ?? bb.rotation ?? 0;
  },

  recalculate: (state: SelectionState) => {
    SelectionState.update(state, state.elements);
  },

  toggle: (dest: SelectionState, element: ResolvedNodeDef) => {
    dest.rotation = undefined;

    const newElements = dest.elements.includes(element)
      ? dest.elements.filter(e => e !== element)
      : [...dest.elements, element];

    SelectionState.update(dest, newElements);
  },

  clear: (dest: SelectionState) => {
    dest.rotation = undefined;
    SelectionState.update(dest, []);
  },

  EMPTY: () => ({
    pos: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
    size: { w: 0, h: 0 },
    rotation: undefined,
    elements: []
  }),

  isEmpty(selection: SelectionState) {
    return selection.elements.length === 0;
  }
};
