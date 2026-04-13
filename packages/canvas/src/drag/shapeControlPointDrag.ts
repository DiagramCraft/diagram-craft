import { Drag, DragEvents } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import type { Releasable } from '@diagram-craft/utils/releasable';

export class ShapeControlPointDrag extends Drag {
  private readonly uow: UnitOfWork;
  private readonly undoSession: Releasable;
  constructor(
    private readonly element: DiagramElement,
    private readonly callback: (pos: Point, uow: UnitOfWork) => string
  ) {
    super();
    this.uow = UnitOfWork.begin(this.element.diagram);
    this.undoSession = this.element.diagram.undoManager.beginUndoableSession('Adjust shape');
  }

  onDrag(event: DragEvents.DragStart) {
    const bounds = this.element.bounds;
    const nodeProps = this.element.renderProps;

    const p = {
      x: (event.offset.x - bounds.x) / bounds.w,
      y: (event.offset.y - bounds.y) / bounds.h
    };

    const transformedCoord = {
      x: bounds.x + bounds.w * (nodeProps.geometry.flipH ? 1 - p.x : p.x),
      y: bounds.y + bounds.h * (nodeProps.geometry.flipV ? 1 - p.y : p.y)
    };

    const label = this.callback(transformedCoord, this.uow);
    this.setState({ label });
    this.uow.notify();

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    this.uow.commitWithUndo('Adjust shape');
    this.undoSession.release();
  }

  cancel() {
    this.uow.abort();
    this.undoSession.release();
  }
}
