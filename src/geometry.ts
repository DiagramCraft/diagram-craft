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
  rotation?: number;
};

const toDegrees = (radians: number) => {
  return radians * (180 / Math.PI);
};

export const Coord = {
  add: (c1: Coord, c2: Coord) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),
  subtract: (c1: Coord, c2: Coord) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  midpoint: (c1: Coord, c2: Coord) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  fromEvent: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  angle: (c1: Coord, c2: Coord) => {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    return toDegrees(Math.atan2(dy, dx) + Math.PI / 2);
  }
};

export const Box = {
  center: (e: Extent, p: Coord) => {
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
      minX = Math.min(minX, box.pos.x, box.pos.x + box.size.w);
      minY = Math.min(minY, box.pos.y, box.pos.y + box.size.h);
      maxX = Math.max(maxX, box.pos.x, box.pos.x + box.size.w);
      maxY = Math.max(maxY, box.pos.y, box.pos.y + box.size.h);
    }

    return {
      pos: { x: minX, y: minY },
      size: { w: maxX - minX, h: maxY - minY }
    };
  },

  contains: (box: Box | undefined, c: Coord): boolean => {
    if (!box) return false;
    return (
      c.x >= box.pos.x &&
      c.x <= box.pos.x + box.size.w &&
      c.y >= box.pos.y &&
      c.y <= box.pos.y + box.size.h
    );
  },
  snapshot(b: Box) {
    return { size: { ...b.size }, pos: { ...b.pos } };
  }
};
