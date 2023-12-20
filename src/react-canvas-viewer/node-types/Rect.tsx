import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder } from '../../geometry/pathBuilder.ts';

export const Rect = (props: Props) => {
  const path = Rect.getBoundingPath(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
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

Rect.getBoundingPath = (def: DiagramNode) => {
  const pathBuilder = new PathBuilder();
  const bnd = def.bounds;

  const bnw = pathBuilder.toWorldCoordinate(bnd, -1, 1);
  const bne = pathBuilder.toWorldCoordinate(bnd, 1, 1);
  const bse = pathBuilder.toWorldCoordinate(bnd, 1, -1);
  const bs1 = pathBuilder.toWorldCoordinate(bnd, -1, -1);

  pathBuilder.moveToPoint(bnw);
  pathBuilder.lineToPoint(bne);
  pathBuilder.lineToPoint(bse);
  pathBuilder.lineToPoint(bs1);
  pathBuilder.lineToPoint(bnw);

  return pathBuilder;
};

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
