import { Point } from '@diagram-craft/geometry/point';
import { makeUndoableAction } from '@diagram-craft/model/undoManager';
import { Drag, DragEvents } from '../dragDropManager';
import type { Diagram } from '@diagram-craft/model/diagram';

const DRAG_THRESHOLD = 4;

export class PointCommentMoveDrag extends Drag {
  #moved = false;
  readonly #originalPosition: Point;
  readonly #pointerOffset: Point;
  #position: Point;

  constructor(
    private readonly diagram: Diagram,
    private readonly commentId: string,
    private readonly initialPointer: Point
  ) {
    super();

    const comment = diagram.commentManager.getComment(commentId);
    if (!comment?.position) {
      throw new Error(`Point comment ${commentId} has no position`);
    }

    this.#originalPosition = comment.position;
    this.#pointerOffset = Point.subtract(comment.position, initialPointer);
    this.#position = comment.position;
  }

  get didMove() {
    return this.#moved;
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    if (
      !this.#moved &&
      Point.distance(offset, this.initialPointer) < DRAG_THRESHOLD / this.diagram.viewBox.zoomLevel
    ) {
      return;
    }

    if (!this.diagram.commentManager.getComment(this.commentId)?.position) return;

    const nextPosition = Point.add(offset, this.#pointerOffset);

    if (!this.diagram.commentManager.updatePointCommentPosition(this.commentId, nextPosition)) {
      return;
    }

    this.#moved = true;
    this.#position = nextPosition;
    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd() {
    if (this.#moved) {
      this.diagram.undoManager.add(
        makeUndoableAction('Move comment', {
          undo: () => {
            this.diagram.commentManager.updatePointCommentPosition(
              this.commentId,
              this.#originalPosition
            );
          },
          redo: () => {
            this.diagram.commentManager.updatePointCommentPosition(this.commentId, this.#position);
          }
        })
      );
    }

    this.emit('dragEnd');
  }

  cancel() {
    if (this.#moved) {
      this.diagram.commentManager.updatePointCommentPosition(
        this.commentId,
        this.#originalPosition
      );
    }
  }
}
