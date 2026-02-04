import { Box } from '@diagram-craft/geometry/box';

const AMOUNT_TO_GROW = 100;

/**
 * Represents the bounds of a diagram.
 * The bounds is a rectangular region that encompasses all nodes and edges.
 * It is used to determine the visible area of the diagram.
 *
 * It is a {@link Box} without rotation
 */
export type DiagramBounds = { w: number; h: number; x: number; y: number };

export const DEFAULT_CANVAS: DiagramBounds = {
  w: 640,
  h: 640,
  x: 0,
  y: 0
};

const resizeDiagramBounds = (orig: DiagramBounds, bbox: Box) => {
  const newBounds = { ...orig };

  if (bbox.x < newBounds.x) {
    const xGrowth = newBounds.x - bbox.x + AMOUNT_TO_GROW;
    newBounds.x -= xGrowth;
    newBounds.w += xGrowth;
  }

  if (bbox.y < newBounds.y) {
    const yGrowth = newBounds.y - bbox.y + AMOUNT_TO_GROW;
    newBounds.y -= yGrowth;
    newBounds.h += yGrowth;
  }

  if (bbox.x + bbox.w > newBounds.x + newBounds.w) {
    newBounds.w = bbox.x + bbox.w - newBounds.x + AMOUNT_TO_GROW;
  }

  if (bbox.y + bbox.h > newBounds.y + newBounds.h) {
    newBounds.h = bbox.y + bbox.h - newBounds.y + AMOUNT_TO_GROW;
  }
  return newBounds;
};

/** @internal */
export const _test = {
  resizeDiagramBounds
};
