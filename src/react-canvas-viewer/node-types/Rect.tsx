import { DiagramNode } from '../../model-viewer/diagram.ts';
import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';

export const Rect = (props: Props) => {
  return (
    <>
      <rect
        x={props.def.bounds.pos.x}
        y={props.def.bounds.pos.y}
        width={props.def.bounds.size.w}
        height={props.def.bounds.size.h}
        className={'svg-node svg-node__boundary'}
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
    </>
  );
};

type Props = {
  def: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
