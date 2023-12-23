import { DiagramNode } from '../../model/diagramNode.ts';
import { assert, precondition } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '../../geometry/pathPosition.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';
import { Drag, Modifiers } from '../../base-ui/drag.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Path } from '../../geometry/path.ts';
import { UndoableAction } from '../../model/undoManager.ts';

class AttachmentPointDrag implements Drag, UndoableAction {
  description = 'Move label node';

  private readonly oldTimeOffset: number;
  private readonly oldOffset: Point;
  private newTimeOffset: number | undefined;
  private newOffset: Point | undefined;

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

export const LabelNodeSelection = (props: Props) => {
  precondition.is.present(props.node.props.labelForEgdeId);

  const drag = useDragDrop();

  const center = Box.center(props.node.bounds);
  const edge = props.node.diagram!.edgeLookup[props.node.props.labelForEgdeId]!;
  assert.present(edge);
  assert.present(edge.labelNode);

  const path = edge.path();
  const attachmentPoint = path.pointAt(
    TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: edge.labelNode.timeOffset! }, path)
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
