import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UndoableAction } from '../../model/undoManager.ts';

class BezierControlUndoAction implements UndoableAction {
  description = 'Move Control point';

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: number,
    private readonly newCPoint: Point,
    private readonly newOCPoint: Point,
    private readonly oldCPoint: Point,
    private readonly oldOCPoint: Point
  ) {}

  undo(): void {
    const wp = this.edge.waypoints![this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    wp.controlPoints![cIdx] = this.oldCPoint;
    wp.controlPoints![ocIdx] = this.oldOCPoint;

    this.edge.update();
  }

  redo(): void {
    const wp = this.edge.waypoints![this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    wp.controlPoints![cIdx] = this.newCPoint;
    wp.controlPoints![ocIdx] = this.newOCPoint;

    this.edge.update();
  }
}

export class BezierControlPointDrag extends AbstractDrag {
  private originalCPoint: Point;
  private originalOCPoint: Point;

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: number
  ) {
    super();
    this.originalCPoint = edge.waypoints![waypointIdx].controlPoints![controlPointIdx];
    this.originalOCPoint =
      edge.waypoints![waypointIdx].controlPoints![controlPointIdx === 0 ? 1 : 0];
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    const wp = this.edge.waypoints![this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    wp.controlPoints![cIdx] = Point.subtract(coord, wp!.point);
    wp.controlPoints![ocIdx] = {
      x: wp.controlPoints![cIdx].x * -1,
      y: wp.controlPoints![cIdx].y * -1
    };

    this.edge.update();
  }

  onDragEnd(): void {
    const wp = this.edge.waypoints![this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    this.diagram.undoManager.add(
      new BezierControlUndoAction(
        this.edge,
        this.waypointIdx,
        this.controlPointIdx,
        wp.controlPoints![cIdx],
        wp.controlPoints![ocIdx],
        this.originalCPoint,
        this.originalOCPoint
      )
    );
  }
}
