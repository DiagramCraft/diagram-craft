import type { EditablePath } from '../editablePath';
import { Drag, DragEvents } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Context } from '../context';

export class NodeDrag extends Drag {
  private readonly startTime: number;
  private readonly capture: UndoCapture;
  private readonly uow: UnitOfWork;
  private readonly initialPositions: Point[];

  private lastPoint: Point | undefined;
  private startPoint: Point | undefined;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIndices: number[],
    private readonly context: Context
  ) {
    super();

    this.startTime = Date.now();
    this.capture = this.editablePath.node.diagram.undoManager.beginCapture('Edit path');
    this.uow = this.capture.unitOfWork;

    this.initialPositions = this.waypointIndices.map(
      idx => this.editablePath.waypoints[idx]!.point
    );

    this.context.help.push('NodeDrag', 'Move waypoints');
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    if (!this.lastPoint) {
      this.startPoint = offset;
    }

    for (let i = 0; i < this.waypointIndices.length; i++) {
      const waypointIdx = this.waypointIndices[i];
      const wp = this.editablePath.waypoints[waypointIdx!]!;

      const delta = Point.subtract(offset, this.startPoint!);
      const newPosition = Point.add(this.initialPositions[i]!, delta);
      wp.point = this.editablePath.toLocalCoordinate(newPosition);
    }
    this.editablePath.commitToNode(this.uow);
    this.uow.notify();

    this.lastPoint = offset;

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    // Abort drag if too short and if the drag was too small
    if (
      this.lastPoint === undefined ||
      this.startPoint === undefined ||
      (Date.now() - this.startTime < 200 && Point.distance(this.lastPoint, this.startPoint) < 5)
    ) {
      this.capture.abort();
      return;
    }

    this.editablePath.commitToNode(this.uow);
    this.capture.commit();

    this.context.help.pop('NodeDrag');
  }

  cancel() {
    this.capture.abort();
  }
}
