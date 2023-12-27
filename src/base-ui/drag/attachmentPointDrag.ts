import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge, ResolvedLabelNode } from '../../model/diagramEdge.ts';
import { Path } from '../../geometry/path.ts';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '../../geometry/pathPosition.ts';

export class AttachmentPointDrag extends AbstractDrag implements UndoableAction {
  description = 'Move label node';

  private readonly oldTimeOffset: number;
  private readonly oldOffset: Point;
  private newTimeOffset: number | undefined;
  private newOffset: Point | undefined;

  constructor(
    private labelNode: ResolvedLabelNode,
    private edge: DiagramEdge,
    private path: Path
  ) {
    super();
    this.oldTimeOffset = labelNode.timeOffset!;
    this.oldOffset = labelNode.offset!;
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    // TODO: This seems to give the wrong result in some situation
    //       Hence the const p = ... below
    const s = this.path.projectPoint(coord);
    const offset = LengthOffsetOnPath.toTimeOffsetOnPath(s, this.path);
    const prevOffset = this.path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: this.labelNode!.timeOffset! }, this.path)
    );
    const p = this.path.pointAt(offset);

    const dx = p.x - prevOffset.x;
    const dy = p.y - prevOffset.y;

    this.labelNode!.timeOffset = offset.pathT;
    if (this.labelNode.type === 'independent') {
      this.labelNode!.offset = {
        x: this.labelNode!.offset.x - dx,
        y: this.labelNode!.offset.y - dy
      };
    }
    this.edge.diagram?.updateElement(this.edge);
  }

  onDragEnd(): void {
    this.newTimeOffset = this.labelNode!.timeOffset!;
    this.newOffset = this.labelNode!.offset!;
    this.edge.diagram?.undoManager.add(this);
  }

  execute(): void {
    this.labelNode!.timeOffset = this.newTimeOffset!;
    this.labelNode!.offset = this.newOffset!;
  }

  undo(): void {
    this.labelNode!.timeOffset = this.oldTimeOffset;
    this.labelNode!.offset = this.oldOffset;
  }
}
