import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Diagram } from '../../model/diagram.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';

declare global {
  interface NodeProps {}
}

export const Circle = (props: Props) => {
  const path = Circle.getBoundingPath(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        className={'svg-node__boundary svg-node'}
        {...propsUtils.filterSvgProperties(props)}
      />

      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={text => {
          props.node.props.text ??= {};
          props.node.props.text.text = text;
          props.node.diagram!.updateElement(props.node);
        }}
        onMouseDown={props.onMouseDown!}
      />
    </>
  );
};

Circle.getBoundingPath = (def: DiagramNode) => {
  const b = new PathBuilder(unitCoordinateSystem(def.bounds));
  b.moveTo(Point.of(0, -1));
  b.arcTo(Point.of(1, 0), 0.5, 0.5);
  b.arcTo(Point.of(0, 1), 0.5, 0.5);
  b.arcTo(Point.of(-1, 0), 0.5, 0.5);
  b.arcTo(Point.of(0, -1), 0.5, 0.5);
  return b;
};

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  nodeProps: NodeProps;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
