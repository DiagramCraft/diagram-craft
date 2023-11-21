import { DiagramNode } from '../../model-viewer/diagram.ts';
import React from 'react';
import { Path } from '../../geometry/path.ts';
import { propsUtils } from '../propsUtils.ts';

export const Star = (props: Props) => {
  const sides = 5;
  const innerRadius = 0.5;

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
        className={'node'}
        style={{ fill: props.isSingleSelected ? 'green' : 'pink' }}
        {...propsUtils.except(props, 'def', 'isSelected', 'isSingleSelected')}
      />

      {props.isSingleSelected && (
        <>
          <circle
            cx={path.positionAt(1).x}
            cy={path.positionAt(1).y}
            r={5}
            stroke="red"
            fill={'transparent'}
            cursor={'crosshair'}
            onMouseDown={e => {
              if (e.button !== 0) return;
              console.log('hit');
              e.stopPropagation();
            }}
          />
          <circle
            cx={path.positionAt(2).x}
            cy={path.positionAt(2).y}
            r={5}
            stroke="red"
            fill={'transparent'}
            cursor={'crosshair'}
            onMouseDown={e => {
              if (e.button !== 0) return;
              console.log('hit');
              e.stopPropagation();
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
