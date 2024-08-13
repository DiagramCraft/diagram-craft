import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { ApplicationTriggers } from '../ApplicationTriggers';

export class EdgeWaypointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private applicationTriggers: ApplicationTriggers
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);

    this.applicationTriggers.pushHelp?.('EdgeWaypointDrag', 'Move waypoint');
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx], coord, this.uow);
    this.uow.notify();
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Move Waypoint');
    this.applicationTriggers.popHelp?.('EdgeWaypointDrag');
  }
}
