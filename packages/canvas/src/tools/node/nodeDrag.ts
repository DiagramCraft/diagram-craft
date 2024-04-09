import { EditablePath } from './editablePath.ts';
import { UnitOfWork } from '@diagram-craft/model';
import { commitWithUndo } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry';
import { AbstractDrag, Modifiers } from '../../dragDropManager.ts';

export class NodeDrag extends AbstractDrag {
  private startTime: number;
  private lastPoint: Point | undefined;
  private uow: UnitOfWork;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly startPoint: Point
  ) {
    super();
    this.startTime = new Date().getTime();
    this.uow = new UnitOfWork(this.editablePath.diagram, true);
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.lastPoint = coord;
    this.editablePath.updateWaypoint(this.waypointIdx, {
      point: this.editablePath.toLocalCoordinate(coord)
    });

    this.editablePath.commitToNode(this.uow);
    this.uow.notify();
  }

  onDragEnd(): void {
    // Abort drag if too short and if the drag was too small
    if (
      this.lastPoint === undefined ||
      (new Date().getTime() - this.startTime < 200 &&
        Point.distance(this.lastPoint, this.startPoint) < 5)
    ) {
      return;
    }

    this.editablePath.commitToNode(this.uow);
    commitWithUndo(this.uow, 'Edit path');
  }
}
