import { Node } from '../Node.tsx';
import { Edge } from '../Edge.tsx';
import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { isNode } from '../../model/diagramElement.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';

export const Group = (props: Props) => {
  const center = Box.center(props.node.bounds);
  return props.node.children.map(child => (
    <g
      key={child.id}
      transform={`rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})`}
    >
      {isNode(child) ? (
        <Node
          def={child}
          diagram={props.node.diagram}
          tool={props.tool}
          onDoubleClick={props.childProps.onDoubleClick}
          onMouseDown={props.childProps.onMouseDown}
          applicationTriggers={props.childProps.applicationTriggers}
        />
      ) : (
        <Edge
          def={child as DiagramEdge}
          diagram={props.node.diagram}
          tool={props.tool}
          onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
          onMouseDown={props.childProps.onMouseDown}
          applicationTriggers={props.childProps.applicationTriggers}
        />
      )}
    </g>
  ));
};

type Props = ReactNodeProps;
