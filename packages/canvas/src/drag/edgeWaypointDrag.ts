import { Drag, DragEvents } from '../dragDropManager';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Context } from '../context';

export class EdgeWaypointDrag extends Drag {
  private readonly capture: UndoCapture;

  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private context: Context
  ) {
    super();
    this.capture = this.edge.diagram.undoManager.beginCapture('Move Waypoint');

    this.context.help.push('EdgeWaypointDrag', 'Move waypoint');
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    this.edge.moveWaypoint(this.edge.waypoints[this.waypointIdx]!, offset, this.capture.uow);
    this.capture.uow.notify();

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
