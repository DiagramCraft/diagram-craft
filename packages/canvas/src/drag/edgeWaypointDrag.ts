import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

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
