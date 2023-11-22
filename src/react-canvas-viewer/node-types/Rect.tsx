import { DiagramNode } from '../../model-viewer/diagram.ts';
import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';

export const Rect = (props: Props) => {
  return (
    <rect
      x={props.def.bounds.pos.x}
      y={props.def.bounds.pos.y}
      width={props.def.bounds.size.w}
      height={props.def.bounds.size.h}
      className={'node'}
      {...propsUtils.except(props, 'def', 'isSelected', 'isSingleSelected')}
    />
  );
};

type Props = {
  def: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
