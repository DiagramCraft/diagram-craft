import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramEdge, ResolvedLabelNode } from '../../model/diagramEdge.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { LengthOffsetOnPath, Path, Point, TimeOffsetOnPath } from '@diagram-craft/geometry';

export class AttachmentPointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private labelNode: ResolvedLabelNode,
    private edge: DiagramEdge,
    private path: Path
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    const pointOnPath = this.path.projectPoint(coord);
    const timeOffset = LengthOffsetOnPath.toTimeOffsetOnPath(pointOnPath, this.path);

    const prevOffset = this.path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: this.labelNode!.timeOffset! }, this.path)
    );
    const delta = Point.subtract(pointOnPath.point, prevOffset);

    const offset =
      this.labelNode.type === 'independent'
        ? Point.subtract(this.labelNode!.offset, delta)
        : this.labelNode.offset;
    this.labelNode.node.updateLabelNode({ timeOffset: timeOffset.pathT, offset: offset }, this.uow);

    this.uow.notify();
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Move label node');
  }
}
