import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
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
