import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Diagram } from '../../model/diagram.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface NodeProps {}
}

export const Circle = (props: Props) => {
  const path = new CircleNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        className={'svg-node__boundary svg-node'}
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

export class CircleNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('circle', 'Circle');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const b = new PathBuilder(unitCoordinateSystem(def.bounds));
    b.moveTo(Point.of(0, -1));
    b.arcTo(Point.of(1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, 1), 0.5, 0.5);
    b.arcTo(Point.of(-1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, -1), 0.5, 0.5);
    return b;
  }
}

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  nodeProps: NodeProps;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
