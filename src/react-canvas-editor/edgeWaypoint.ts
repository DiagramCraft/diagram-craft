import { UndoableAction } from '../model/undoManager.ts';
import { DiagramEdge } from '../model/diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { Drag, Modifiers } from '../base-ui/drag.ts';
import { Diagram } from '../model/diagram.ts';

class WaypointUndoAction implements UndoableAction {
  description = 'Move Waypoint';

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly newPoint: Point,
    private readonly oldPoint: Point
  ) {}

  undo(): void {
    this.edge.waypoints![this.waypointIdx].point = this.oldPoint;
    this.diagram.updateElement(this.edge);
  }

  redo(): void {
    this.edge.waypoints![this.waypointIdx].point = this.newPoint;
    this.diagram.updateElement(this.edge);
  }
}

export class EdgeWaypointDrag implements Drag {
  private startPoint: Point;

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number
  ) {
    this.startPoint = edge.waypoints![waypointIdx].point;
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.edge.waypoints![this.waypointIdx].point = coord;
    this.diagram.updateElement(this.edge);
  }

  onDragEnd(): void {
    this.diagram.undoManager.add(
      new WaypointUndoAction(
        this.diagram,
        this.edge,
        this.waypointIdx,
        this.edge.waypoints![this.waypointIdx].point,
        this.startPoint
      )
    );
  }
}
