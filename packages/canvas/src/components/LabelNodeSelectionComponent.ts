import { assert, precondition } from '@diagram-craft/utils';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { AttachmentPointDrag } from '../drag/attachmentPointDrag';
import { Box } from '@diagram-craft/geometry/box';
import { TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class LabelNodeSelectionComponent extends Component<Props> {
  render(props: Props) {
    precondition.is.present(props.node.props.labelForEdgeId);

    const center = Box.center(props.node.bounds);
    const edge = props.node.labelEdge();
    assert.present(edge);

    const labelNode = props.node.labelNode();
    assert.present(labelNode);

    const path = edge.path();
    const attachmentPoint = path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: labelNode.timeOffset! }, path)
    );

    return svg.g(
      {},
      svg.circle({
        class: 'svg-selection__label-node',
        cx: center.x,
        cy: center.y,
        r: 3
      }),
      svg.circle({
        class: 'svg-selection__label-node',
        cx: attachmentPoint.x,
        cy: attachmentPoint.y,
        r: 4,
        on: {
          mousedown: e => {
            if (e.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(new AttachmentPointDrag(labelNode, edge, path));
            e.stopPropagation();
          }
        }
      }),
      svg.line({
        class: 'svg-selection__label-node__line',
        x1: center.x,
        y1: center.y,
        x2: attachmentPoint.x,
        y2: attachmentPoint.y
      })
    );
  }
}

type Props = {
  node: DiagramNode;
};
