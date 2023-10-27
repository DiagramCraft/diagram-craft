export type Coord = {
  x: number;
  y: number;
};

export type Extent = {
  w: number;
  h: number;
};

export type Box = {
  pos: Coord;
  size: Extent;
};

export const Extent = {
  midpoint: (e: Extent, p: Coord) => {
    return {
      x: p.x + e.w / 2,
      y: p.y + e.h / 2
    };
  },

  boundingBox: (boxes: Box[]): Box => {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    for (const box of boxes) {
      minX = Math.min(minX, box.pos.x);
      minY = Math.min(minY, box.pos.y);
      maxX = Math.max(maxX, box.pos.x + box.size.w);
      maxY = Math.max(maxY, box.pos.y + box.size.h);
    }

    return {
      pos: { x: minX, y: minY },
      size: { w: maxX - minX, h: maxY - minY }
    };
  }
};
