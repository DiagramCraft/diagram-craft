import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';

// TODO: Can we replace this with LCS
/**
 * Transforms a point from the unit coordinate system to the given bounding box.
 * The unit coordinate system is a 2D coordinate system where x and y range from -1 to 1.
 * The transformation is done by scaling and translating the point to fit into the bounding box.
 *
 * @param {Point} point - The point in the unit coordinate system to be transformed
 * @param {Box} b - The bounding box where the point should be placed.
 *                  It is an object with x, y, w (width), and h (height) properties.
 * @returns {Object} The transformed point in the bounding box coordinate system
 */
export const pointInBounds = ({ x, y }: Point, b: Box) => {
  return {
    x: b.x + ((x + 1) * b.w) / 2,
    y: b.y + b.h - ((y + 1) * b.h) / 2
  };
};
