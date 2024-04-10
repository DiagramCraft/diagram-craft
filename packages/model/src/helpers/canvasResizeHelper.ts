import { Box, Extent, Point } from '@diagram-craft/geometry';
import { Canvas, Diagram } from '../diagram';
import { UndoableAction } from '../undoManager';

const AMOUNT_TO_GROW = 100;

export const createResizeCanvasActionToFit = (
  diagram: Diagram,
  bbox: Box
): ResizeCanvasAction | undefined => {
  const orig = diagram.canvas;

  let canvas = diagram.canvas;

  if (bbox.x < canvas.x) {
    const dx = canvas.x - bbox.x + AMOUNT_TO_GROW;
    canvas = {
      w: canvas.w + dx,
      h: canvas.h,
      x: canvas.x - dx,
      y: canvas.y
    };
  }
  if (bbox.y < canvas.y) {
    const dy = canvas.y - bbox.y + AMOUNT_TO_GROW;
    canvas = {
      w: canvas.w,
      h: canvas.h + dy,
      x: canvas.x,
      y: canvas.y - dy
    };
  }
  if (bbox.x + bbox.w > canvas.x + canvas.w) {
    const dx = bbox.x + bbox.w - canvas.x - canvas.w + AMOUNT_TO_GROW;
    canvas = {
      w: canvas.x + canvas.w - canvas.x + dx,
      h: canvas.h,
      x: canvas.x,
      y: canvas.y
    };
  }
  if (bbox.y + bbox.h > canvas.y + canvas.h) {
    const dy = bbox.y + bbox.h - canvas.y - canvas.h + AMOUNT_TO_GROW;
    canvas = {
      w: canvas.w,
      h: canvas.y + canvas.h - canvas.y + dy,
      x: canvas.x,
      y: canvas.y
    };
  }

  if (Point.isEqual(canvas, orig) && Extent.isEqual(canvas, orig)) return undefined;

  return new ResizeCanvasAction(diagram, diagram.canvas, canvas);
};

class ResizeCanvasAction implements UndoableAction {
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
