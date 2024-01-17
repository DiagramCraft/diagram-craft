import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Vector } from '../../geometry/vector.ts';

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
    const wp = this.edge.waypoints[this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    const controlPoints: [Point, Point] = [Point.ORIGIN, Point.ORIGIN];
    controlPoints[cIdx] = this.oldCPoint;
    controlPoints[ocIdx] = this.oldOCPoint;

    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.updateWaypoint(this.waypointIdx, { ...wp, controlPoints }, uow)
    );
  }

  redo(): void {
    const wp = this.edge.waypoints[this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    const controlPoints: [Point, Point] = [Point.ORIGIN, Point.ORIGIN];
    controlPoints[cIdx] = this.newCPoint;
    controlPoints[ocIdx] = this.newOCPoint;

    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.updateWaypoint(this.waypointIdx, { ...wp, controlPoints }, uow)
    );
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
    this.originalCPoint = edge.waypoints[waypointIdx].controlPoints![controlPointIdx];
    this.originalOCPoint =
      edge.waypoints[waypointIdx].controlPoints![controlPointIdx === 0 ? 1 : 0];
  }

  // meta - preserve ratios
  // alt - ignore angle
  onDrag(coord: Point, modifiers: Modifiers) {
    const wp = this.edge.waypoints[this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    const controlPoints: [Point, Point] = [Point.ORIGIN, Point.ORIGIN];
    controlPoints[cIdx] = Point.subtract(coord, wp!.point);

    if (modifiers.metaKey) {
      controlPoints[ocIdx] = {
        x: wp.controlPoints![cIdx].x * -1,
        y: wp.controlPoints![cIdx].y * -1
      };
    } else if (!modifiers.altKey) {
      const oLength = Point.distance(Point.ORIGIN, wp.controlPoints![ocIdx]);
      controlPoints[ocIdx] = Vector.fromPolar(
        Vector.angle(wp.controlPoints![cIdx]) + Math.PI,
        oLength
      );
    }

    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.updateWaypoint(this.waypointIdx, { ...wp, controlPoints }, uow)
    );
  }

  onDragEnd(): void {
    const wp = this.edge.waypoints[this.waypointIdx];

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
