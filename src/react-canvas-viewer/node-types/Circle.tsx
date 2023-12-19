import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Diagram } from '../../model/diagram.ts';
import { PathBuilder } from '../../geometry/pathBuilder.ts';

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
  const w = def.bounds.size.w;
  const h = def.bounds.size.h;
  const pathBuilder = new PathBuilder();

  const c0 = pathBuilder.toWorldCoordinate(def.bounds, 0, -1);
  pathBuilder.moveToPoint(c0);

  const c1 = pathBuilder.toWorldCoordinate(def.bounds, 1, 0);
  pathBuilder.arcTo(0.5 * w, 0.5 * h, Math.PI / 2, 0, 0, c1.x, c1.y);

  const c2 = pathBuilder.toWorldCoordinate(def.bounds, 0, 1);
  pathBuilder.arcTo(0.5 * w, 0.5 * h, Math.PI / 2, 0, 0, c2.x, c2.y);

  const c3 = pathBuilder.toWorldCoordinate(def.bounds, -1, 0);
  pathBuilder.arcTo(0.5 * w, 0.5 * h, Math.PI / 2, 0, 0, c3.x, c3.y);

  pathBuilder.arcTo(0.5 * w, 0.5 * h, Math.PI / 2, 0, 0, c0.x, c0.y);
  return pathBuilder;
};

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  nodeProps: NodeProps;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
