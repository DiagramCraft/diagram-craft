import { Drag, DragEvents } from '../dragDropManager';
import { Path } from '@diagram-craft/geometry/path';
import { Point } from '@diagram-craft/geometry/point';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramEdge, ResolvedLabelNode } from '@diagram-craft/model/diagramEdge';

export class LabelAttachmentPointDrag extends Drag {
  private readonly uow: UnitOfWork;

  constructor(
    private labelNode: ResolvedLabelNode,
    private edge: DiagramEdge,
    private path: Path
  ) {
    super();
    this.uow = UnitOfWork.begin(this.edge.diagram);
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
      .updateLabelNode({ timeOffset: timeOffset.pathT, offset: offset }, this.uow);

    this.uow.notify();

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    this.uow.commitWithUndo('Move label node');
  }

  cancel() {
    this.uow.abort();
  }
}
