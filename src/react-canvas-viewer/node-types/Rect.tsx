import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

export const Rect = (props: Props) => {
  const path = new RectNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        {...propsUtils.filterSvgProperties(props)}
      />
      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={text => {
          UnitOfWork.execute(props.node.diagram, uow =>
            props.node.updateProps(props => {
              props.text ??= {};
              props.text.text = text;
            }, uow)
          );
        }}
        onMouseDown={props.onMouseDown!}
      />
    </>
  );
};

export class RectNodeDefinition extends AbstractReactNodeDefinition {
  constructor(name = 'rect', displayName = 'Rectangle') {
    super(name, displayName);
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
} & React.SVGProps<SVGRectElement>;
