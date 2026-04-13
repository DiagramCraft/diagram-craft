import { Drag, DragEvents } from '../dragDropManager';
import { Path } from '@diagram-craft/geometry/path';
import { Point } from '@diagram-craft/geometry/point';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import { DiagramEdge, ResolvedLabelNode } from '@diagram-craft/model/diagramEdge';

export class LabelAttachmentPointDrag extends Drag {
  private readonly capture: UndoCapture;

  constructor(
    private labelNode: ResolvedLabelNode,
    private edge: DiagramEdge,
    private path: Path
  ) {
    super();
    this.capture = this.edge.diagram.undoManager.beginCapture('Move label node');
  }

  onDrag(event: DragEvents.DragStart): void {
    const pointOnPath = this.path.projectPoint(event.offset);
    const timeOffset = LengthOffsetOnPath.toTimeOffsetOnPath(pointOnPath, this.path);

    const prevOffset = this.path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: this.labelNode.timeOffset }, this.path)
    );
    const delta = Point.subtract(pointOnPath.point, prevOffset);

    const offset =
      this.labelNode.type === 'independent'
        ? Point.subtract(this.labelNode.offset, delta)
        : this.labelNode.offset;
    this.labelNode
      .node()
      .updateLabelNode({ timeOffset: timeOffset.pathT, offset: offset }, this.capture.uow);

    this.capture.uow.notify();

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    this.capture.commit();
  }

  cancel() {
    this.capture.abort();
  }
}
