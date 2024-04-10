import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ControlPoints } from '@diagram-craft/model/types';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

const otherCp = (cIdx: 'cp1' | 'cp2') => (cIdx === 'cp1' ? 'cp2' : 'cp1');

const isSmoothDrag = (modifiers: Modifiers) => modifiers.metaKey;
const isCornerDrag = (modifiers: Modifiers) => modifiers.altKey;

export class EdgeControlPointDrag extends AbstractDrag {
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
    commitWithUndo(this.uow, 'Move Control point');
  }
}
