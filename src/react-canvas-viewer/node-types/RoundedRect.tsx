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
  const radius = props.node.props?.roundedRect?.radius ?? 10;

  return (
    <>
      <rect
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        className={'svg-node svg-node__boundary'}
        rx={radius}
        ry={radius}
        {...propsUtils.except(props, 'node', 'isSelected', 'isSingleSelected')}
      />

      <TextPart
        text={props.node.props.text?.text}
        bounds={props.node.bounds}
        onChange={text => {
          props.node.props.text ??= {};
          props.node.props.text.text = text;
          props.node.diagram!.updateElement(props.node);
        }}
        onMouseDown={props.onMouseDown!}
      />

      {props.isSingleSelected && (
        <ShapeControlPoint
          x={props.node.bounds.pos.x + radius}
          y={props.node.bounds.pos.y}
          def={props.node}
          onDrag={x => {
            const distance = Math.max(0, x - props.node.bounds.pos.x);
            props.node.props.roundedRect ??= {};
            props.node.props.roundedRect.radius = distance;
          }}
        />
      )}
    </>
  );
};

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
