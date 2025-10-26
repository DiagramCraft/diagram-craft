import type { Diagram } from './diagram';
import { UndoableAction } from './undoManager';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';

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

/**
 * Creates an undoable action to resize the bounds to fit a bounding box.
 * Expands the bounds by 100 pixels in each direction as needed.
 *
 * @param diagram - The diagram whose bounds will be resized
 * @param bbox - The bounding box that must fit within the bounds
 * @returns An undoable action if resizing is needed, undefined otherwise
 */
export const createResizeToFitAction = (diagram: Diagram, bbox: Box) => {
  const originalBounds = diagram.bounds;
  const newBounds = resizeDiagramBounds(diagram.bounds, bbox);

  if (isBoundsEqual(newBounds, originalBounds)) {
    return undefined;
  }

  return new ResizeDiagramBoundsUndoableAction(diagram, diagram.bounds, newBounds);
};

const isBoundsEqual = (newCanvas: DiagramBounds, originalCanvas: DiagramBounds) =>
  Point.isEqual(newCanvas, originalCanvas) && Extent.isEqual(newCanvas, originalCanvas);

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

class ResizeDiagramBoundsUndoableAction implements UndoableAction {
  description = 'Resize bounds';

  constructor(
    private readonly diagram: Diagram,
    private readonly before: DiagramBounds,
    private readonly after: DiagramBounds
  ) {}

  undo() {
    this.diagram.bounds = this.before;
  }

  redo() {
    this.diagram.bounds = this.after;
  }
}

/** @internal */
export const _test = {
  ResizeDiagramBoundsUndoableAction,
  resizeDiagramBounds
};
