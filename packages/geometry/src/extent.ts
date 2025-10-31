export type Extent = Readonly<{
  w: number;
  h: number;
}>;

/** @namespace */
export const Extent = {
  of: (w: number, h: number): Extent => ({ w, h }),
  isEqual: (a: Extent, b: Extent) => a.w === b.w && a.h === b.h
};
