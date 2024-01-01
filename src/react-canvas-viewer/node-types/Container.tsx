import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Edge } from '../Edge.tsx';
import { Node } from '../Node.tsx';

export const Container = (props: Props) => {
  const path = Container.getBoundingPath(props.node).getPath();
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
            onDoubleClick={() => {}}
            onMouseDown={() => {}}
            onMouseLeave={() => {}}
            onMouseEnter={() => {}}
          />
        ) : (
          <Edge
            key={child.id}
            def={child}
            diagram={props.node.diagram}
            onDoubleClick={() => {}}
            onMouseDown={() => {}}
            onMouseLeave={() => {}}
            onMouseEnter={() => {}}
          />
        )
      )}
    </>
  );
};

Container.getBoundingPath = (def: DiagramNode) => {
  const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
  pathBuilder.moveTo(Point.of(-1, 1));
  pathBuilder.lineTo(Point.of(1, 1));
  pathBuilder.lineTo(Point.of(1, -1));
  pathBuilder.lineTo(Point.of(-1, -1));
  pathBuilder.lineTo(Point.of(-1, 1));

  return pathBuilder;
};

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
