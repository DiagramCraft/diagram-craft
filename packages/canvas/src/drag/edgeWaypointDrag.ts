import { AbstractDrag, Modifiers } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { commitWithUndo } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry';

export class EdgeWaypointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx], coord, this.uow);
    this.uow.notify();
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Move Waypoint');
  }
}
