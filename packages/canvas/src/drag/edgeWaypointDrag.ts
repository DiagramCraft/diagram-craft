import { Drag, DragEvents } from '../dragDropManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Context } from '../context';

export class EdgeWaypointDrag extends Drag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private context: Context
  ) {
    super();
    this.uow = UnitOfWork.begin(this.edge.diagram);

    this.context.help.push('EdgeWaypointDrag', 'Move waypoint');
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx]!, offset, this.uow);
    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    this.uow.commitWithUndo('Move Waypoint');
    this.context.help.pop('EdgeWaypointDrag');
  }

  cancel() {
    this.uow.abort();
  }
}
