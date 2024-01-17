import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Vector } from '../../geometry/vector.ts';
import { ControlPoints } from '../../model/types.ts';

const otherCp = (cIdx: 'cp1' | 'cp2') => (cIdx === 'cp1' ? 'cp2' : 'cp1');

class BezierControlUndoAction implements UndoableAction {
  description = 'Move Control point';

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: keyof ControlPoints,
    private readonly newCPoint: Point,
    private readonly newOCPoint: Point,
    private readonly oldCPoint: Point,
    private readonly oldOCPoint: Point
  ) {}

  undo(): void {
    const wp = this.edge.waypoints[this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

    const controlPoints = {
      [cIdx]: this.oldCPoint,
      [ocIdx]: this.oldOCPoint
    } as ControlPoints;

    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.updateWaypoint(this.waypointIdx, { ...wp, controlPoints }, uow)
    );
  }

  redo(): void {
    const wp = this.edge.waypoints[this.waypointIdx];
    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

    const controlPoints = {
      [cIdx]: this.newCPoint,
      [ocIdx]: this.newOCPoint
    } as ControlPoints;

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
    private readonly controlPointIdx: keyof ControlPoints
  ) {
    super();
    this.originalCPoint = edge.waypoints[waypointIdx].controlPoints![controlPointIdx];
    this.originalOCPoint = edge.waypoints[waypointIdx].controlPoints![otherCp(controlPointIdx)];
  }

  // meta - preserve ratios
  // alt - ignore angle
  onDrag(coord: Point, modifiers: Modifiers) {
    const wp = this.edge.waypoints[this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

    let otherControlPoint: Point;
    if (modifiers.metaKey) {
      otherControlPoint = {
        x: wp.controlPoints![cIdx].x * -1,
        y: wp.controlPoints![cIdx].y * -1
      };
    } else if (!modifiers.altKey) {
      otherControlPoint = Vector.fromPolar(
        Vector.angle(wp.controlPoints![cIdx]) + Math.PI,
        Point.distance(Point.ORIGIN, wp.controlPoints![ocIdx])
      );
    } else {
      otherControlPoint = wp.controlPoints![ocIdx];
    }

    const controlPoints: ControlPoints = {
      [cIdx]: Point.subtract(coord, wp!.point),
      [ocIdx]: otherControlPoint
    } as ControlPoints;

    UnitOfWork.execute(this.edge.diagram, uow =>
      this.edge.updateWaypoint(
        this.waypointIdx,
        { ...wp, controlPoints: controlPoints as ControlPoints },
        uow
      )
    );
  }

  onDragEnd(): void {
    const wp = this.edge.waypoints[this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

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
