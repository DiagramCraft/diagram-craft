import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

class WaypointUndoAction implements UndoableAction {
  description = 'Move Waypoint';

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly newPoint: Point,
    private readonly oldPoint: Point
  ) {}

  undo(): void {
    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx], this.oldPoint, uow)
    );
  }

  redo(): void {
    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx], this.newPoint, uow)
    );
  }
}

export class EdgeWaypointDrag extends AbstractDrag {
  private startPoint: Point;

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number
  ) {
    super();
    this.startPoint = edge.waypoints[waypointIdx].point;
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx], coord, uow)
    );
  }

  onDragEnd(): void {
    this.diagram.undoManager.add(
      new WaypointUndoAction(
        this.edge,
        this.waypointIdx,
        this.edge.waypoints[this.waypointIdx].point,
        this.startPoint
      )
    );
  }
}
