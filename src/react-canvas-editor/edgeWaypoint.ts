import { UndoableAction } from '../model-editor/undoManager.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { Drag, Modifiers } from '../base-ui/drag.ts';

class WaypointUndoAction implements UndoableAction {
  description = 'Move Waypoint';

  canUndo = true;
  canRedo = true;

  constructor(
    private readonly diagram: EditableDiagram,
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
    private readonly diagram: EditableDiagram,
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
