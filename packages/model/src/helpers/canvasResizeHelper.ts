import { Canvas, Diagram } from '../diagram';
import { UndoableAction } from '../undoManager';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';

const AMOUNT_TO_GROW = 100;

/**
 * This expands the canvas to fit the given bounding box with a margin of
 * AMOUNT_TO_GROW.
 *
 * It creates a new canvas and does not modify the original.
 */
const resizeCanvas = (orig: Canvas, bbox: Box) => {
  const newCanvas = { ...orig };

  if (bbox.x < newCanvas.x) {
    const dx = newCanvas.x - bbox.x + AMOUNT_TO_GROW;
    newCanvas.x -= dx;
    newCanvas.w += dx;
  }
  if (bbox.y < newCanvas.y) {
    const dy = newCanvas.y - bbox.y + AMOUNT_TO_GROW;
    newCanvas.y -= dy;
    newCanvas.h += dy;
  }
  if (bbox.x + bbox.w > newCanvas.x + newCanvas.w) {
    newCanvas.w = bbox.x + bbox.w - newCanvas.x + AMOUNT_TO_GROW;
  }
  if (bbox.y + bbox.h > newCanvas.y + newCanvas.h) {
    newCanvas.h = bbox.y + bbox.h - newCanvas.y + AMOUNT_TO_GROW;
  }
  return newCanvas;
};

export const createResizeCanvasActionToFit = (
  diagram: Diagram,
  bbox: Box
): ResizeCanvasUndoableAction | undefined => {
  const originalCanvas = diagram.canvas;
  const newCanvas = resizeCanvas(diagram.canvas, bbox);

  if (Point.isEqual(newCanvas, originalCanvas) && Extent.isEqual(newCanvas, originalCanvas)) {
    return undefined;
  }

  return new ResizeCanvasUndoableAction(diagram, diagram.canvas, newCanvas);
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

export const _test = {
  ResizeCanvasUndoableAction,
  resizeCanvas
};
