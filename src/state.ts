import { ResolvedNodeDef } from './diagram.ts';
import { Coord, Extent } from './types.ts';

export type SelectionState = {
  pos: Coord;
  size: Extent;
  elements: string;
};

export const SelectionState = {
  update: (dest: SelectionState | undefined, elements: ResolvedNodeDef) => {
    const d: Partial<SelectionState> = dest || {};
    d.elements = elements.id;
    d.pos = { ...elements.world };
    d.size = { ...elements.size };
    return d as SelectionState;
  }
};
