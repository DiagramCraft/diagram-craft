import { DiagramNode } from '../../model/diagramNode.ts';
import { precondition } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { buildEdgePath } from '../../base-ui/edgePathBuilder.ts';
import { TimeOffsetOnPath } from '../../geometry/pathPosition.ts';

export const LabelNodeSelection = (props: Props) => {
  precondition.is.present(props.node.props.labelForEgdeId);

  const center = Box.center(props.node.bounds);

  const edge = props.node.diagram?.edgeLookup[props.node.props.labelForEgdeId];

  // TODO: Fix the second rounding parameter
  const path = buildEdgePath(edge!, 0);
  const attachmentPoint = path.pointAt(
    TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: edge!.labelNode!.timeOffset! }, path)
  );

  return (
    <>
      <circle cx={center.x} cy={center.y} r="3" className={'svg-selection__label-node'} />
      <circle
        cx={attachmentPoint.x}
        cy={attachmentPoint.y}
        r="4"
        className={'svg-selection__label-node'}
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
