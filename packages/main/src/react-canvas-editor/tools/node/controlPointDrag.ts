import { AbstractDrag, Modifiers } from '../../../base-ui/drag/dragDropManager.ts';
import { EditablePath } from './editablePath.ts';
import { Point } from '../../../geometry/point.ts';
import { UnitOfWork } from '../../../model/unitOfWork.ts';
import { commitWithUndo } from '../../../model/diagramUndoActions.ts';

export class ControlPointDrag extends AbstractDrag {
  private uow: UnitOfWork;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2'
  ) {
    super();
    this.uow = new UnitOfWork(this.editablePath.diagram, true);
  }

  onDrag(coord: Point, modifiers: Modifiers) {
    this.editablePath.updateControlPoint(
      this.waypointIdx,
      this.controlPoint,
      this.editablePath.toLocalCoordinate(coord),
      modifiers.metaKey ? 'symmetric' : modifiers.altKey ? 'corner' : undefined
    );

    this.editablePath.commitToNode(this.uow);
    this.uow.notify();
  }

  onDragEnd(): void {
    this.editablePath.commitToNode(this.uow);
    commitWithUndo(this.uow, 'Edit path');
  }
}
