import type { EditablePath } from '../editablePath';
import { Drag, DragEvents } from '../dragDropManager';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Context } from '../context';

export class GenericPathControlPointDrag extends Drag {
  private readonly capture: UndoCapture;
  private readonly uow: UnitOfWork;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2',
    private readonly context: Context
  ) {
    super();
    this.capture = this.editablePath.node.diagram.undoManager.beginCapture('Edit path');
    this.uow = this.capture.unitOfWork;

    this.context.help.push(
      'GenericPathControlPointDrag',
      'Move control point. Cmd-drag - symmetric, Alt-drag - smooth'
    );
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    const wp = this.editablePath.waypoints[this.waypointIdx]!;
    wp.updateControlPoint(
      this.controlPoint,
      this.editablePath.toLocalCoordinate(offset),
      modifiers.metaKey ? 'symmetric' : modifiers.altKey ? 'smooth' : 'corner'
    );

    this.editablePath.commitToNode(this.uow);
    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    this.editablePath.commitToNode(this.uow);
    this.capture.commit();

    this.context.help.pop('GenericPathControlPointDrag');
  }

  cancel() {
    this.capture.abort();
  }
}
