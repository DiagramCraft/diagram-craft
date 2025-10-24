import type { Diagram } from './diagram';
import { UndoableAction } from './undoManager';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';

const AMOUNT_TO_GROW = 100;

/**
 * Represents the canvas of a diagram.
 * The canvas is a rectangular region that encompasses all nodes and edges.
 * It is used to determine the visible area of the diagram.
 *
 * It is a {@link Box} without rotation
 */
export type Canvas = Omit<Box, 'r'>;

export const DEFAULT_CANVAS: Canvas = {
  w: 640,
  h: 640,
  x: 0,
  y: 0
};

/**
 * Creates an undoable action to resize the canvas to fit a bounding box.
 * Expands the canvas by AMOUNT_TO_GROW pixels in each direction as needed.
 *
 * @param diagram - The diagram whose canvas will be resized
 * @param bbox - The bounding box that must fit within the canvas
 * @returns An undoable action if resizing is needed, undefined otherwise
 */
export const createResizeCanvasActionToFit = (
  diagram: Diagram,
  bbox: Box
): ResizeCanvasUndoableAction | undefined => {
  const originalCanvas = diagram.canvas;
  const newCanvas = resizeCanvas(diagram.canvas, bbox);

  if (isCanvasEqual(newCanvas, originalCanvas)) {
    return undefined;
  }

  return new ResizeCanvasUndoableAction(diagram, diagram.canvas, newCanvas);
};

const isCanvasEqual = (newCanvas: Canvas, originalCanvas: Canvas) =>
  Point.isEqual(newCanvas, originalCanvas) && Extent.isEqual(newCanvas, originalCanvas);

const resizeCanvas = (orig: Canvas, bbox: Box) => {
  const newCanvas = { ...orig };

  if (bbox.x < newCanvas.x) {
    const xGrowth = newCanvas.x - bbox.x + AMOUNT_TO_GROW;
    newCanvas.x -= xGrowth;
    newCanvas.w += xGrowth;
  }

  if (bbox.y < newCanvas.y) {
    const yGrowth = newCanvas.y - bbox.y + AMOUNT_TO_GROW;
    newCanvas.y -= yGrowth;
    newCanvas.h += yGrowth;
  }

  if (bbox.x + bbox.w > newCanvas.x + newCanvas.w) {
    newCanvas.w = bbox.x + bbox.w - newCanvas.x + AMOUNT_TO_GROW;
  }

  if (bbox.y + bbox.h > newCanvas.y + newCanvas.h) {
    newCanvas.h = bbox.y + bbox.h - newCanvas.y + AMOUNT_TO_GROW;
  }
  return newCanvas;
};

class ResizeCanvasUndoableAction implements UndoableAction {
  description = 'Resize canvas';

  constructor(
    private readonly diagram: Diagram,
    private readonly before: Canvas,
    private readonly after: Canvas
  ) {}

  undo() {
    this.diagram.canvas = this.before;
  }

  redo() {
    this.diagram.canvas = this.after;
  }
}

/** @internal */
export const _test = {
  ResizeCanvasUndoableAction,
  resizeCanvas
};
