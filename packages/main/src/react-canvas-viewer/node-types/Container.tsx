import { propsUtils } from '../utils/propsUtils.ts';
import { Edge } from '../Edge.tsx';
import { Node } from '../Node.tsx';
import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { isNode } from '../../model/diagramElement.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { ContainerNodeDefinition } from './Container.nodeType.ts';

export const Container = (props: Props) => {
  const path = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  const center = Box.center(props.node.bounds);
  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        stroke={props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : '#d5d5d4'}
        strokeWidth={props.nodeProps.highlight?.includes('drop-target') ? 3 : 1}
        fill={'transparent'}
        {...propsUtils.filterSvgProperties(props, 'fill', 'stroke', 'strokeWidth', 'style')}
      />
      {props.node.children.map(child => (
        <g
          key={child.id}
          transform={`rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})`}
        >
          {isNode(child) ? (
            <Node
              def={child}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick}
              onMouseDown={props.childProps.onMouseDown}
              applicationTriggers={props.childProps.applicationTriggers}
              tool={props.tool}
            />
          ) : (
            <Edge
              def={child as DiagramEdge}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
              onMouseDown={props.childProps.onMouseDown}
              applicationTriggers={props.childProps.applicationTriggers}
              tool={props.tool}
            />
          )}
        </g>
      ))}
    </>
  );
};

type Props = ReactNodeProps;
