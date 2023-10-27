import {ResolvedNodeDef} from "./diagram.ts";

export type Coord = {
  x: number;
  y: number;
};

export type SelectionState = {
  x: number;
  y: number;
  w: number;
  h: number;
  elements: string
}

export const SelectionState = {
  update: (dest: SelectionState | undefined, elements: ResolvedNodeDef) => {
    const d: Partial<SelectionState> = dest || {};
    d.elements = elements.id;
    d.x = elements.world.x;
    d.y = elements.world.y;
    d.w = elements.w;
    d.h = elements.h;
    return d as SelectionState;
  }
};
