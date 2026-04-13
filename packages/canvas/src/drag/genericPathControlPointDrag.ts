import type { EditablePath } from '../editablePath';
import { Drag, DragEvents } from '../dragDropManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Context } from '../context';
import type { Releasable } from '@diagram-craft/utils/releasable';

export class GenericPathControlPointDrag extends Drag {
  private readonly uow: UnitOfWork;
  private readonly undoSession: Releasable;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2',
    private readonly context: Context
  ) {
    super();
    this.uow = UnitOfWork.begin(this.editablePath.node.diagram);
    this.undoSession = this.editablePath.node.diagram.undoManager.beginUndoableSession('Edit path');

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
    this.uow.commitWithUndo('Edit path');
    this.undoSession.release();

    this.context.help.pop('GenericPathControlPointDrag');
  }

  cancel() {
    this.uow.abort();
    this.undoSession.release();
  }
}
