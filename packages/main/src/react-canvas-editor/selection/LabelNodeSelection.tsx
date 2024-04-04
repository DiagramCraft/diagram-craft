import { DiagramNode } from '../../model/diagramNode.ts';
import { assert, precondition } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { TimeOffsetOnPath } from '../../geometry/pathPosition.ts';
import { DRAG_DROP_MANAGER } from '../../react-canvas-viewer/DragDropManager.ts';
import { AttachmentPointDrag } from '../../base-ui/drag/attachmentPointDrag.ts';
import { Component } from '../../base-ui/component.ts';
import * as svg from '../../base-ui/vdom-svg.ts';

export class LabelNodeSelectionComponent extends Component<Props> {
  render(props: Props) {
    precondition.is.present(props.node.props.labelForEdgeId);

    const drag = DRAG_DROP_MANAGER;

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
            drag.initiate(new AttachmentPointDrag(labelNode, edge, path));
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

/*
export const LabelNodeSelection = (props: Props) => {
const ref = useComponent<Props, LabelNodeSelectionComponent, SVGGElement>(
  () => new LabelNodeSelectionComponent(),
  props
);

return <g ref={ref}></g>;


precondition.is.present(props.node.props.labelForEdgeId);

const drag = DRAG_DROP_MANAGER;

const center = Box.center(props.node.bounds);
const edge = props.node.labelEdge();
assert.present(edge);

const labelNode = props.node.labelNode();
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
 */

type Props = {
  node: DiagramNode;
};
