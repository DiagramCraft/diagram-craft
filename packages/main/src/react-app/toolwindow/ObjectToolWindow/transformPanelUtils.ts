import { Point } from '@diagram-craft/geometry/point';
import type { Box } from '@diagram-craft/geometry/box';

export const transformOrigins = {
  tl: { x: 0, y: 0 },
  tc: { x: 0.5, y: 0 },
  tr: { x: 1, y: 0 },
  ml: { x: 0, y: 0.5 },
  mc: { x: 0.5, y: 0.5 },
  mr: { x: 1, y: 0.5 },
  bl: { x: 0, y: 1 },
  bc: { x: 0.5, y: 1 },
  br: { x: 1, y: 1 }
} as const;

export type TransformOrigin = keyof typeof transformOrigins;

export const getTransformedBounds = (bounds: Box | undefined, origin: TransformOrigin): Box => {
  return {
    x: (bounds?.x ?? 0) + (bounds?.w ?? 1) * transformOrigins[origin].x,
    y: (bounds?.y ?? 0) + (bounds?.h ?? 1) * transformOrigins[origin].y,
    w: bounds?.w ?? 1,
    h: bounds?.h ?? 1,
    r: bounds?.r ?? 0
  };
};

export const getBoundsFromTransformedBounds = (
  bounds: Box,
  previousBounds: Box,
  origin: TransformOrigin
): Box => {
  const newBounds = { ...bounds };

  newBounds.x -= previousBounds.w * transformOrigins[origin].x;
  newBounds.y -= previousBounds.h * transformOrigins[origin].y;

  if (newBounds.w !== previousBounds.w) {
    const dw = newBounds.w - previousBounds.w;
    newBounds.x -= dw * transformOrigins[origin].x;
  }

  if (newBounds.h !== previousBounds.h) {
    const dh = newBounds.h - previousBounds.h;
    newBounds.y -= dh * transformOrigins[origin].y;
  }

  if (newBounds.r !== previousBounds.r) {
    const centerOfRotation = Point.subtract(transformOrigins[origin], { x: 0.5, y: 0.5 });
    const newPos = Point.rotateAround(Point.ORIGIN, newBounds.r, centerOfRotation);
    const prevPos = Point.rotateAround(Point.ORIGIN, previousBounds.r, centerOfRotation);

    newBounds.x = newBounds.x - prevPos.x * previousBounds.w + newPos.x * newBounds.w;
    newBounds.y = newBounds.y - prevPos.y * previousBounds.h + newPos.y * newBounds.h;
  }

  return newBounds;
};
