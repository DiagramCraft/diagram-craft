import { Drag, DragEvents } from '../dragDropManager';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Context } from '../context';

export class EdgeWaypointDrag extends Drag {
  private readonly capture: UndoCapture;
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private context: Context
  ) {
    super();
    this.capture = this.edge.diagram.undoManager.beginCapture('Move Waypoint');
    this.uow = this.capture.unitOfWork;

    this.context.help.push('EdgeWaypointDrag', 'Move waypoint');
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx]!, offset, this.uow);
    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    this.capture.commit();
    this.context.help.pop('EdgeWaypointDrag');
  }

  cancel() {
    this.capture.abort();
  }
}
