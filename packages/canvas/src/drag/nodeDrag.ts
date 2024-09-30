import { EditablePath } from '../editablePath';
import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Context } from '../ApplicationTriggers';

export class NodeDrag extends AbstractDrag {
  private startTime: number;
  private lastPoint: Point | undefined;
  private startPoint: Point | undefined;
  private uow: UnitOfWork;

  private initialPositions: Point[];

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIndices: number[],
    private readonly context: Context
  ) {
    super();

    this.startTime = new Date().getTime();
    this.uow = new UnitOfWork(this.editablePath.node.diagram, true);

    this.initialPositions = this.waypointIndices.map(idx => this.editablePath.waypoints[idx].point);

    this.context.help.push('NodeDrag', 'Move waypoints');
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    if (!this.lastPoint) {
      this.startPoint = coord;
    }

    for (let i = 0; i < this.waypointIndices.length; i++) {
      const waypointIdx = this.waypointIndices[i];
      const wp = this.editablePath.waypoints[waypointIdx];

      const delta = Point.subtract(coord, this.startPoint!);
      const newPosition = Point.add(this.initialPositions[i], delta);
      wp.point = this.editablePath.toLocalCoordinate(newPosition);
    }
    this.editablePath.commitToNode(this.uow);
    this.uow.notify();

    this.lastPoint = coord;
  }

  onDragEnd(): void {
    // Abort drag if too short and if the drag was too small
    if (
      this.lastPoint === undefined ||
      this.startPoint === undefined ||
      (new Date().getTime() - this.startTime < 200 &&
        Point.distance(this.lastPoint, this.startPoint!) < 5)
    ) {
      this.uow.abort();
      return;
    }

    this.editablePath.commitToNode(this.uow);
    commitWithUndo(this.uow, 'Edit path');

    this.context.help.pop('NodeDrag');
  }
}
