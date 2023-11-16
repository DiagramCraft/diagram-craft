export type Extent = Readonly<{
  w: number;
  h: number;
}>;

export const Extent = {
  isEqual: (a: Extent, b: Extent) => {
    return a.w === b.w && a.h === b.h;
  }
};
