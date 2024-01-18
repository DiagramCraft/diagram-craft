import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

export class EdgeWaypointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly diagram: Diagram,
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
    const snapshot = this.uow.commit();

    this.diagram.undoManager.add(
      new SnapshotUndoableAction('Move Waypoint', this.diagram, snapshot)
    );
  }
}
