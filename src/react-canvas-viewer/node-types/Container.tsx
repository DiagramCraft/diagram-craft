import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Edge } from '../Edge.tsx';
import { Node } from '../Node.tsx';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';

export const Container = (props: Props) => {
  const path = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        stroke={'orange'}
        strokeDasharray={'5,5'}
        fill={'transparent'}
        {...propsUtils.filterSvgProperties(props, 'fill', 'stroke', 'style')}
      />
      {props.node.children.map(child =>
        child.type === 'node' ? (
          <Node
            key={child.id}
            def={child}
            diagram={props.node.diagram}
            onDoubleClick={props.childProps.onDoubleClick}
            onMouseDown={props.childProps.onMouseDown}
            onMouseLeave={props.childProps.onMouseLeave}
            onMouseEnter={props.childProps.onMouseEnter}
          />
        ) : (
          <Edge
            key={child.id}
            def={child}
            diagram={props.node.diagram}
            onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
            onMouseDown={props.childProps.onMouseDown}
            onMouseLeave={props.childProps.onMouseLeave}
            onMouseEnter={props.childProps.onMouseEnter}
          />
        )
      )}
    </>
  );
};

export class ContainerNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('container', 'Container');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }
}

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onMouseEnter: (id: string) => void;
    onMouseLeave: (id: string) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
  };
} & Omit<
  React.SVGProps<SVGRectElement>,
  'onMouseEnter' | 'onMouseDown' | 'onMouseLeave' | 'onDoubleClick'
>;
