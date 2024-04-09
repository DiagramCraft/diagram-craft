import { EditablePath } from './editablePath.ts';
import { UnitOfWork } from '@diagram-craft/model';
import { commitWithUndo } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry';
import { AbstractDrag, Modifiers } from '../../dragDropManager.ts';

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
