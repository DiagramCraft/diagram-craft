import { DiagramNode } from '../../model/diagramNode.ts';
import { assert, precondition } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { TimeOffsetOnPath } from '../../geometry/pathPosition.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';
import { AttachmentPointDrag } from '../../base-ui/drag/attachmentPointDrag.ts';

export const LabelNodeSelection = (props: Props) => {
  precondition.is.present(props.node.props.labelForEgdeId);

  const drag = useDragDrop();

  const center = Box.center(props.node.bounds);
  const edge = props.node.diagram!.edgeLookup[props.node.props.labelForEgdeId]!;
  assert.present(edge);
  assert.present(edge.labelNodes);

  const labelNode = edge.labelNodes.find(ln => ln.node === props.node);
  assert.present(labelNode);

  const path = edge.path();
  const attachmentPoint = path.pointAt(
    TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: labelNode.timeOffset! }, path)
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
          drag.initiate(new AttachmentPointDrag(labelNode, edge, path));
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
