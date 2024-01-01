import { Canvas, Diagram } from '../diagram.ts';
import { Box } from '../../geometry/box.ts';
import { UndoableAction } from '../undoManager.ts';
import { Point } from '../../geometry/point.ts';
import { Extent } from '../../geometry/extent.ts';

const AMOUNT_TO_GROW = 100;

export const createResizeCanvasActionToFit = (
  diagram: Diagram,
  bbox: Box
): ResizeCanvasAction | undefined => {
  const orig = diagram.canvas;

  let canvas = diagram.canvas;

  if (bbox.pos.x < canvas.pos.x) {
    const dx = canvas.pos.x - bbox.pos.x + AMOUNT_TO_GROW;
    canvas = {
      size: { w: canvas.size.w + dx, h: canvas.size.h },
      pos: { x: canvas.pos.x - dx, y: canvas.pos.y }
    };
  }
  if (bbox.pos.y < canvas.pos.y) {
    const dy = canvas.pos.y - bbox.pos.y + AMOUNT_TO_GROW;
    canvas = {
      size: { w: canvas.size.w, h: canvas.size.h + dy },
      pos: { x: canvas.pos.x, y: canvas.pos.y - dy }
    };
  }
  if (bbox.pos.x + bbox.size.w > canvas.pos.x + canvas.size.w) {
    const dx = bbox.pos.x + bbox.size.w - canvas.pos.x - canvas.size.w + AMOUNT_TO_GROW;
    canvas = {
      size: { w: canvas.pos.x + canvas.size.w - canvas.pos.x + dx, h: canvas.size.h },
      pos: { x: canvas.pos.x, y: canvas.pos.y }
    };
  }
  if (bbox.pos.y + bbox.size.h > canvas.pos.y + canvas.size.h) {
    const dy = bbox.pos.y + bbox.size.h - canvas.pos.y - canvas.size.h + AMOUNT_TO_GROW;
    canvas = {
      size: { w: canvas.size.w, h: canvas.pos.y + canvas.size.h - canvas.pos.y + dy },
      pos: { x: canvas.pos.x, y: canvas.pos.y }
    };
  }

  if (Point.isEqual(canvas.pos, orig.pos) && Extent.isEqual(canvas.size, orig.size))
    return undefined;

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
