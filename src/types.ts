export type Coord = {
  x: number;
  y: number;
};

export type Extent = {
  w: number;
  h: number;
};

export const Extent = {
  midpoint: (e: Extent, p: Coord) => {
    return {
      x: p.x + e.w / 2,
      y: p.y + e.h / 2
    };
  }
};
