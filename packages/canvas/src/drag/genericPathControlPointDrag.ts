import { EditablePath } from '../editablePath';
import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Context } from '../ApplicationTriggers';

export class GenericPathControlPointDrag extends AbstractDrag {
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

  onDrag(coord: Point, modifiers: Modifiers) {
    const wp = this.editablePath.waypoints[this.waypointIdx];
    wp.updateControlPoint(
      this.controlPoint,
      this.editablePath.toLocalCoordinate(coord),
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
