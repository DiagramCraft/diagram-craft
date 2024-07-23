import { EditablePath } from '../editablePath';
import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { ApplicationTriggers } from '../EditableCanvasComponent';

export class GenericPathControlPointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2',
    private readonly applicationTriggers: ApplicationTriggers
  ) {
    super();
    this.uow = new UnitOfWork(this.editablePath.node.diagram, true);

    this.applicationTriggers.pushHelp?.(
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

    this.applicationTriggers.popHelp?.('GenericPathControlPointDrag');
  }
}
