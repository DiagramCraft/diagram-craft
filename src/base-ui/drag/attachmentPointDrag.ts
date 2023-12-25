import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Path } from '../../geometry/path.ts';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '../../geometry/pathPosition.ts';

export class AttachmentPointDrag extends AbstractDrag implements UndoableAction {
  description = 'Move label node';

  private readonly oldTimeOffset: number;
  private readonly oldOffset: Point;
  private newTimeOffset: number | undefined;
  private newOffset: Point | undefined;

  constructor(
    private edge: DiagramEdge,
    private path: Path
  ) {
    super();
    this.oldTimeOffset = edge.labelNode!.timeOffset!;
    this.oldOffset = edge.labelNode!.offset!;
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    // TODO: This seems to give the wrong result in some situation
    //       Hence the const p = ... below
    const s = this.path.projectPoint(coord);
    const offset = LengthOffsetOnPath.toTimeOffsetOnPath(s, this.path);
    const prevOffset = this.path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: this.edge.labelNode!.timeOffset! }, this.path)
    );
    const p = this.path.pointAt(offset);

    const dx = p.x - prevOffset.x;
    const dy = p.y - prevOffset.y;

    this.edge.labelNode!.timeOffset = offset.pathT;
    this.edge.labelNode!.offset = {
      x: this.edge.labelNode!.offset.x - dx,
      y: this.edge.labelNode!.offset.y - dy
    };
    this.edge.diagram?.updateElement(this.edge);
  }

  onDragEnd(): void {
    this.newTimeOffset = this.edge.labelNode!.timeOffset!;
    this.newOffset = this.edge.labelNode!.offset!;
    this.edge.diagram?.undoManager.add(this);
  }

  execute(): void {
    this.edge.labelNode!.timeOffset = this.newTimeOffset!;
    this.edge.labelNode!.offset = this.newOffset!;
  }

  undo(): void {
    this.edge.labelNode!.timeOffset = this.oldTimeOffset;
    this.edge.labelNode!.offset = this.oldOffset;
  }
}
