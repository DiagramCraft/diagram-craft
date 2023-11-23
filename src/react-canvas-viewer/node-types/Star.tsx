import { DiagramNode } from '../../model-viewer/diagram.ts';
import React from 'react';
import { Path } from '../../geometry/path.ts';
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
  const sides = props.def.props?.star?.numberOfSides ?? 5;
  const innerRadius = props.def.props?.star?.innerRadius ?? 0.5;

  const theta = Math.PI / 2;
  const dTheta = (2 * Math.PI) / sides;

  const path = new Path('UNIT', props.def.bounds);
  path.moveTo(0, 1);

  for (let i = 0; i < sides; i++) {
    const angle = theta - (i + 1) * dTheta;

    const iAngle = angle + dTheta / 2;
    path.lineTo(Math.cos(iAngle) * innerRadius, Math.sin(iAngle) * innerRadius);

    path.lineTo(Math.cos(angle), Math.sin(angle));
  }

  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.def.bounds.pos.x}
        y={props.def.bounds.pos.y}
        width={props.def.bounds.size.w}
        height={props.def.bounds.size.h}
        className={'node-boundary node'}
        {...propsUtils.except(props, 'def', 'isSelected', 'isSingleSelected')}
      />

      <TextPart
        text={props.def.props.text?.text}
        bounds={props.def.bounds}
        onChange={text => {
          props.def.props.text ??= {};
          props.def.props.text.text = text;
          props.def.diagram!.updateElement(props.def);
        }}
        onMouseDown={props.onMouseDown!}
      />

      {props.isSingleSelected && (
        <>
          <ShapeControlPoint
            x={path.positionAt(1).x}
            y={path.positionAt(1).y}
            def={props.def}
            onDrag={(x, y) => {
              const distance = Point.distance({ x, y }, Box.center(props.def.bounds));
              props.def.props.star ??= {};
              props.def.props.star.innerRadius = distance / (props.def.bounds.size.w / 2);
            }}
          />
          <ShapeControlPoint
            x={path.positionAt(2).x}
            y={path.positionAt(2).y}
            def={props.def}
            onDrag={(x, y) => {
              const angle =
                Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.def.bounds)));
              const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

              props.def.props.star ??= {};
              props.def.props.star.numberOfSides = numberOfSides;
            }}
          />
        </>
      )}
    </>
  );
};

type Props = {
  def: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
