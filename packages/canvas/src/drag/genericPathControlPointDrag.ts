import type { EditablePath } from '../editablePath';
import { Drag, DragEvents } from '../dragDropManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Context } from '../context';

export class GenericPathControlPointDrag extends Drag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2',
    private readonly context: Context
  ) {
    super();
    this.uow = new UnitOfWork(this.editablePath.node.diagram, true);

    this.context.help.push(
      'GenericPathControlPointDrag',
      'Move control point. Cmd-drag - symmetric, Alt-drag - smooth'
    );
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    const wp = this.editablePath.waypoints[this.waypointIdx];
    wp.updateControlPoint(
      this.controlPoint,
      this.editablePath.toLocalCoordinate(offset),
      modifiers.metaKey ? 'symmetric' : modifiers.altKey ? 'smooth' : 'corner'
    );

    this.editablePath.commitToNode(this.uow);
    this.uow.notify();
  }

  onDragEnd(): void {
    this.editablePath.commitToNode(this.uow);
    commitWithUndo(this.uow, 'Edit path');

    this.context.help.pop('GenericPathControlPointDrag');
  }
}
