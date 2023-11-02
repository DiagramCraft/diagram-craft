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
  toDeg: (radians: number) => {
    return radians * (180 / Math.PI);
  },

  toRad: (degrees: number) => {
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
    return Angle.toDeg(Math.atan2(dy, dx) + Math.PI / 2);
  },

  round: (c: Coord) => {
    return { x: Math.round(c.x), y: Math.round(c.y) };
  },

  negate: (c: Coord) => ({ x: -c.x, y: -c.y }),

  translate: (c: Coord, d: Coord): Coord => {
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
  },

  rotateAround: (c: Coord, r: number, centerOfRotation: Coord) => {
    const newCoord = Coord.subtract(c, centerOfRotation);
    const rotatedCoord = Coord.rotate(newCoord, r);
    return Coord.translate(rotatedCoord, centerOfRotation);
  }
};

export const Box = {
  center: (b: Box) => {
    return {
      x: b.pos.x + b.size.w / 2,
      y: b.pos.y + b.size.h / 2
    };
  },

  positionFromCenter: (b: Box, center: Coord): Box => {
    b.pos = {
      x: center.x - b.size.w / 2,
      y: center.y - b.size.h / 2
    };
    return b;
  },

  boundingBox: (boxes: Box[]): Box => {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    // If all boxes have the same rotation
    if (boxes.every(b => b.rotation === boxes[0].rotation) && boxes[0].rotation !== undefined) {
      // Pick one corner of one box and rotate each corner of each box around it
      const rotationPoint = Box.corners(boxes[0], true)[0];
      for (const box of boxes) {
        for (const c of Box.corners(box, true)) {
          const rotated = Coord.rotate(
            Coord.subtract(c, rotationPoint),
            -Angle.toRad(box.rotation ?? 0)
          );

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
        }
      }

      const w = maxX - minX;
      const h = maxY - minY;

      const centerOfSelection = Coord.rotate(
        { x: minX + w / 2, y: minY + h / 2 },
        Angle.toRad(boxes[0].rotation ?? 0)
      );

      const posOfSelection = Coord.add(
        rotationPoint,
        Coord.subtract(centerOfSelection, { x: w / 2, y: h / 2 })
      );

      return {
        pos: posOfSelection,
        size: { w: w, h: h },
        rotation: boxes[0].rotation
      };
    } else {
      for (const box of boxes) {
        minX = Math.min(minX, box.pos.x, box.pos.x + box.size.w);
        minY = Math.min(minY, box.pos.y, box.pos.y + box.size.h);
        maxX = Math.max(maxX, box.pos.x, box.pos.x + box.size.w);
        maxY = Math.max(maxY, box.pos.y, box.pos.y + box.size.h);

        const corners = [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y },
          { x: box.pos.x, y: box.pos.y + box.size.h },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h }
        ];
        for (const c of corners) {
          const rotated = Coord.rotateAround(c, Angle.toRad(box.rotation ?? 0), Box.center(box));

          minX = Math.min(minX, rotated.x);
          minY = Math.min(minY, rotated.y);
          maxX = Math.max(maxX, rotated.x);
          maxY = Math.max(maxY, rotated.y);
        }
      }

      return {
        pos: { x: minX, y: minY },
        size: { w: maxX - minX, h: maxY - minY }
      };
    }
  },

  corners: (box: Box, oppositeOnly = false) => {
    const corners = oppositeOnly
      ? [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h }
        ]
      : [
          { x: box.pos.x, y: box.pos.y },
          { x: box.pos.x + box.size.w, y: box.pos.y },
          { x: box.pos.x, y: box.pos.y + box.size.h },
          { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h }
        ];

    // TODO: We can probalby check for rouding to one decimal here
    if (box.rotation === undefined || box.rotation === 0) return corners;

    return corners.map(c => Coord.rotateAround(c, Angle.toRad(box.rotation ?? 0), Box.center(box)));
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
    return { size: { ...b.size }, pos: { ...b.pos }, rotation: b.rotation };
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

export interface Transform {
  asSvgTransform(): string;
  apply(b: Box): Box;
  apply(b: Coord): Coord;
  apply(b: Box | Coord): Box | Coord;
  reverse(): Transform;
}

export const Transform = {
  box: (b: Box, ...transforms: Transform[]): Box => {
    return transforms.reduce((b, t) => t.apply(b), b);
  },
  coord: (b: Coord, ...transforms: Transform[]): Coord => {
    return transforms.reduce((b, t) => t.apply(b), b);
  }
};

export class Translation implements Transform {
  constructor(private readonly c: Coord) {}

  asSvgTransform() {
    return `translate(${this.c.x},${this.c.y})`;
  }

  apply(b: Box): Box;
  apply(b: Coord): Coord;
  apply(b: Box | Coord): Box | Coord {
    if ('pos' in b) {
      return Box.translate(b, this.c) as Box;
    } else {
      return Coord.translate(b, this.c) as Coord;
    }
  }

  reverse(): Transform {
    return new Translation(Coord.negate(this.c));
  }
}

export class Scale implements Transform {
  constructor(private readonly s: number) {}

  asSvgTransform() {
    return `scale(${this.s})`;
  }

  apply(b: Box): Box;
  apply(b: Coord): Coord;
  apply(b: Box | Coord): Box | Coord {
    if ('pos' in b) {
      return Box.scale(b, this.s);
    } else {
      return Coord.scale(b, this.s);
    }
  }

  reverse(): Transform {
    return new Scale(1 / this.s);
  }
}

export class Rotation implements Transform {
  constructor(private readonly r: number) {}

  asSvgTransform() {
    return `rotate(${this.r})`;
  }

  apply(b: Box): Box;
  apply(b: Coord): Coord;
  apply(b: Box | Coord): Box | Coord {
    if ('pos' in b) {
      return Box.rotate(b, this.r);
    } else {
      return Coord.rotate(b, this.r);
    }
  }

  reverse(): Transform {
    return new Rotation(-this.r);
  }
}
