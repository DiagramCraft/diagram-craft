import { DiagramNode } from '../../model-viewer/diagram.ts';
import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';

declare global {
  interface NodeProps {
    roundedRect?: {
      radius?: number;
    };
  }
}

export const RoundedRect = (props: Props) => {
  const radius = props.def.props?.roundedRect?.radius ?? 10;

  return (
    <>
      <rect
        x={props.def.bounds.pos.x}
        y={props.def.bounds.pos.y}
        width={props.def.bounds.size.w}
        height={props.def.bounds.size.h}
        className={'svg-node svg-node__boundary'}
        rx={radius}
        ry={radius}
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
        <ShapeControlPoint
          x={props.def.bounds.pos.x + radius}
          y={props.def.bounds.pos.y}
          def={props.def}
          onDrag={x => {
            const distance = Math.max(0, x - props.def.bounds.pos.x);
            props.def.props.roundedRect ??= {};
            props.def.props.roundedRect.radius = distance;
          }}
        />
      )}
    </>
  );
};

type Props = {
  def: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
