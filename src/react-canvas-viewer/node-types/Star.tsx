import { DiagramNode, NodeDefinition } from '../../model-viewer/diagram.ts';
import React from 'react';
import { PathBuilder } from '../../geometry/pathBuilder.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Vector } from '../../geometry/vector.ts';
import { TextPart } from '../TextPart.tsx';

declare global {
  interface NodeProps {
    star?: {
      numberOfSides?: number;
      innerRadius?: number;
    };
  }
}

export const Star = (props: Props) => {
  const path = props.def.getBoundingPath(props.node);
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
        {...propsUtils.except(props, 'node', 'isSelected', 'isSingleSelected')}
      />

      <TextPart
        text={props.node.props.text}
        bounds={props.node.bounds}
        onChange={text => {
          props.node.props.text ??= {};
          props.node.props.text.text = text;
          props.node.diagram!.updateElement(props.node);
        }}
        onMouseDown={props.onMouseDown!}
      />

      {props.isSingleSelected && (
        <>
          <ShapeControlPoint
            x={path.segments[1].start.x}
            y={path.segments[1].start.y}
            def={props.node}
            onDrag={(x, y) => {
              const distance = Point.distance({ x, y }, Box.center(props.node.bounds));
              props.node.props.star ??= {};
              props.node.props.star.innerRadius = distance / (props.node.bounds.size.w / 2);
            }}
          />
          <ShapeControlPoint
            x={path.segments[2].start.x}
            y={path.segments[2].start.y}
            def={props.node}
            onDrag={(x, y) => {
              const angle =
                Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
              const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

              props.node.props.star ??= {};
              props.node.props.star.numberOfSides = numberOfSides;
            }}
          />
        </>
      )}
    </>
  );
};

Star.getBoundingPath = (def: DiagramNode) => {
  const sides = def.props?.star?.numberOfSides ?? 5;
  const innerRadius = def.props?.star?.innerRadius ?? 0.5;

  const theta = Math.PI / 2;
  const dTheta = (2 * Math.PI) / sides;

  const pathBuilder = new PathBuilder();
  pathBuilder.moveToPoint(pathBuilder.toWorldCoordinate(def.bounds, 0, 1));

  for (let i = 0; i < sides; i++) {
    const angle = theta - (i + 1) * dTheta;

    const iAngle = angle + dTheta / 2;
    pathBuilder.lineToPoint(
      pathBuilder.toWorldCoordinate(
        def.bounds,
        Math.cos(iAngle) * innerRadius,
        Math.sin(iAngle) * innerRadius
      )
    );

    pathBuilder.lineToPoint(
      pathBuilder.toWorldCoordinate(def.bounds, Math.cos(angle), Math.sin(angle))
    );
  }

  return pathBuilder.getPath();
};

type Props = {
  def: NodeDefinition;
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
