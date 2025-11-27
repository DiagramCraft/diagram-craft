import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ControlPoints, DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Context } from '../context';

const otherCp = (cIdx: 'cp1' | 'cp2') => (cIdx === 'cp1' ? 'cp2' : 'cp1');

const isSmoothDrag = (modifiers: Modifiers) => modifiers.metaKey;
const isSymmetricDrag = (modifiers: Modifiers) => modifiers.altKey;

export class EdgeControlPointDrag extends Drag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: keyof ControlPoints,
    private readonly context: Context
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);

    this.context.help.push(
      'EdgeControlPointDrag',
      'Move control point. Cmd-drag - symmetric, Alt-drag - smooth'
    );
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    const wp = this.edge.waypoints[this.waypointIdx]!;

    const cIdx = this.controlPointIdx;
    const ocIdx = otherCp(cIdx);

    let otherControlPoint = wp.controlPoints![ocIdx];
    if (isSmoothDrag(modifiers)) {
      otherControlPoint = {
        x: wp.controlPoints![cIdx].x * -1,
        y: wp.controlPoints![cIdx].y * -1
      };
    } else if (isSymmetricDrag(modifiers)) {
      otherControlPoint = Vector.fromPolar(
        Vector.angle(wp.controlPoints![cIdx]) + Math.PI,
        Point.distance(Point.ORIGIN, wp.controlPoints![ocIdx])
      );
    }

    const controlPoints = {
      [cIdx]: Point.subtract(offset, wp.point),
      [ocIdx]: otherControlPoint
    } as ControlPoints;

    this.edge.replaceWaypoint(this.waypointIdx, { ...wp, controlPoints: controlPoints }, this.uow);

    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Move Control point');

    this.context.help.pop('EdgeControlPointDrag');
  }
}
