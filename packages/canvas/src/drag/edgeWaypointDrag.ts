import { Drag, DragEvents } from '../dragDropManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Context } from '../context';
import type { Releasable } from '@diagram-craft/utils/releasable';

export class EdgeWaypointDrag extends Drag {
  private readonly uow: UnitOfWork;
  private readonly undoSession: Releasable;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private context: Context
  ) {
    super();
    this.uow = UnitOfWork.begin(this.edge.diagram);
    this.undoSession = this.edge.diagram.undoManager.beginUndoableSession('Move Waypoint');

    this.context.help.push('EdgeWaypointDrag', 'Move waypoint');
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx]!, offset, this.uow);
    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    this.uow.commitWithUndo('Move Waypoint');
    this.undoSession.release();
    this.context.help.pop('EdgeWaypointDrag');
  }

  cancel() {
    this.uow.abort();
    this.undoSession.release();
  }
}
