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

export const Angle = {
  toDegrees: (radians: number) => {
    return radians * (180 / Math.PI);
  },

  toRadians: (degrees: number) => {
    return degrees * (Math.PI / 180);
  }
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
    return Angle.toDegrees(Math.atan2(dy, dx) + Math.PI / 2);
  },

  round: (c: Coord) => {
    return { x: Math.round(c.x), y: Math.round(c.y) };
  },

  negate: (c: Coord) => ({ x: -c.x, y: -c.y }),

  translate: (c: Coord, d: Coord) => {
    return { x: c.x + d.x, y: c.y + d.y };
  },

  scale: (c: Coord, s: number) => {
    return { x: c.x * s, y: c.y * s };
  },

  rotate: (c: Coord, r: number) => {
    return {
      x: c.x * Math.cos(r) - c.y * Math.sin(r),
      y: c.x * Math.sin(r) + c.y * Math.cos(r)
    };
  }
};

export const Box = {
  center: (b: Box) => {
    return {
      x: b.pos.x + b.size.w / 2,
      y: b.pos.y + b.size.h / 2
    };
  },

  // TODO: This doesn't respect rotation
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
  },

  translate: (b: Box, c: Coord): Box => {
    return {
      pos: Coord.add(b.pos, c),
      size: { ...b.size }
    };
  },

  scale: (b: Box, s: number): Box => {
    const midpoint = Box.center(b);
    const newMidpoint = Coord.subtract(midpoint, b.pos);
    const scaledMidpoint = Coord.subtract(newMidpoint, {
      x: newMidpoint.x * s,
      y: newMidpoint.y * s
    });
    const newBox = Box.translate(b, scaledMidpoint);
    newBox.size.w *= s;
    newBox.size.h *= s;
    return newBox;
  },

  rotate: (b: Box, r: number): Box => {
    const midpoint = Box.center(b);
    const newMidpoint = Coord.subtract(midpoint, b.pos);
    const rotatedMidpoint = {
      x: newMidpoint.x * Math.cos(r) - newMidpoint.y * Math.sin(r),
      y: newMidpoint.x * Math.sin(r) + newMidpoint.y * Math.cos(r)
    };
    const newBox = Box.translate(b, rotatedMidpoint);
    newBox.rotation = r;
    return newBox;
  },

  rotateAround: (b: Box, r: number, centerOfRotation: Coord): Box => {
    const midpoint = Box.center(b);
    const newMidpoint = Coord.subtract(midpoint, centerOfRotation);
    const rotatedMidpoint = {
      x: newMidpoint.x * Math.cos(r) - newMidpoint.y * Math.sin(r),
      y: newMidpoint.x * Math.sin(r) + newMidpoint.y * Math.cos(r)
    };
    const newBox = Box.translate(b, rotatedMidpoint);
    newBox.rotation = r;
    return newBox;
  }
};
