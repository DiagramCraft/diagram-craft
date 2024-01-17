import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Vector } from '../../geometry/vector.ts';
import { ControlPoints } from '../../model/types.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

const otherCp = (cIdx: 'cp1' | 'cp2') => (cIdx === 'cp1' ? 'cp2' : 'cp1');

const isSmoothDrag = (modifiers: Modifiers) => modifiers.metaKey;
const isCornerDrag = (modifiers: Modifiers) => modifiers.altKey;

export class BezierControlPointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: keyof ControlPoints
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);
  }

  onDrag(coord: Point, modifiers: Modifiers) {
    const wp = this.edge.waypoints[this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

    let otherControlPoint = wp.controlPoints![ocIdx];
    if (isSmoothDrag(modifiers)) {
      otherControlPoint = {
        x: wp.controlPoints![cIdx].x * -1,
        y: wp.controlPoints![cIdx].y * -1
      };
    } else if (!isCornerDrag(modifiers)) {
      otherControlPoint = Vector.fromPolar(
        Vector.angle(wp.controlPoints![cIdx]) + Math.PI,
        Point.distance(Point.ORIGIN, wp.controlPoints![ocIdx])
      );
    }

    const controlPoints = {
      [cIdx]: Point.subtract(coord, wp!.point),
      [ocIdx]: otherControlPoint
    } as ControlPoints;

    this.edge.updateWaypoint(this.waypointIdx, { ...wp, controlPoints: controlPoints }, this.uow);

    this.uow.notify();
  }

  onDragEnd(): void {
    const snapshot = this.uow.commit();

    this.edge.diagram.undoManager.add(
      new SnapshotUndoableAction(
        'Move Control point',
        snapshot,
        snapshot.retakeSnapshot(this.edge.diagram),
        this.edge.diagram
      )
    );
  }
}
