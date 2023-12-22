import { DiagramNode } from '../../model/diagramNode.ts';
import { precondition } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { buildEdgePath } from '../../base-ui/edgePathBuilder.ts';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '../../geometry/pathPosition.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';
import { Drag, Modifiers } from '../../base-ui/drag.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Path } from '../../geometry/path.ts';
import { UndoableAction } from '../../model/undoManager.ts';

class AttachmentPointDragUndoableAction implements UndoableAction {
  description = 'Move label node';

  private newTimeOffset: number;
  private newOffset: Point;

  constructor(
    private edge: DiagramEdge,
    private oldTimeOffset: number,
    private oldOffset: Point
  ) {
    this.newTimeOffset = edge.labelNode!.timeOffset!;
    this.newOffset = edge.labelNode!.offset!;
  }

  execute(): void {
    this.edge.labelNode!.timeOffset = this.newTimeOffset;
    this.edge.labelNode!.offset = this.newOffset;
  }

  undo(): void {
    this.edge.labelNode!.timeOffset = this.oldTimeOffset;
    this.edge.labelNode!.offset = this.oldOffset;
  }
}

class AttachmentPointDrag implements Drag {
  private oldTimeOffset: number;
  private oldOffset: Point;

  constructor(
    private edge: DiagramEdge,
    private path: Path
  ) {
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
    this.edge.diagram?.undoManager.add(
      new AttachmentPointDragUndoableAction(this.edge, this.oldTimeOffset, this.oldOffset)
    );
  }
}

export const LabelNodeSelection = (props: Props) => {
  precondition.is.present(props.node.props.labelForEgdeId);

  const drag = useDragDrop();

  const center = Box.center(props.node.bounds);

  const edge = props.node.diagram!.edgeLookup[props.node.props.labelForEgdeId]!;

  // TODO: Fix the second rounding parameter
  const path = buildEdgePath(edge!, 0);
  const attachmentPoint = path.pointAt(
    TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: edge.labelNode!.timeOffset! }, path)
  );

  return (
    <>
      <circle cx={center.x} cy={center.y} r="3" className={'svg-selection__label-node'} />
      <circle
        cx={attachmentPoint.x}
        cy={attachmentPoint.y}
        r="4"
        className={'svg-selection__label-node'}
        onMouseDown={e => {
          if (e.button !== 0) return;

          drag.initiate(new AttachmentPointDrag(edge, path));
          e.stopPropagation();
        }}
      />
      <line
        x1={center.x}
        y1={center.y}
        x2={attachmentPoint.x}
        y2={attachmentPoint.y}
        className={'svg-selection__label-node__line'}
      />
    </>
  );
};

type Props = {
  node: DiagramNode;
};
