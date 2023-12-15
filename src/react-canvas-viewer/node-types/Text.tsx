import React, { useCallback } from 'react';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Box } from '../../geometry/box.ts';
import { Extent } from '../../geometry/extent.ts';
import { Diagram } from '../../model/diagram.ts';

export const Text = (props: Props) => {
  const sizeChangeCallback = useCallback(
    (size: Extent) => {
      const height = size.h;
      const width = size.w;

      const b = Box.asMutableSnapshot(props.node.bounds);
      if (height !== props.node.bounds.size.h) {
        b.get('size')!.h = height;
      }
      if (width !== props.node.bounds.size.w) {
        b.get('size')!.w = width;
      }
      props.node.bounds = b.getSnapshot();

      props.node.diagram!.updateElement(props.node);
    },
    [props.node]
  );

  return (
    <>
      <rect
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        className={'svg-node svg-node__boundary'}
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
        onSizeChange={sizeChangeCallback}
        onMouseDown={props.onMouseDown!}
      />
    </>
  );
};

Text.defaultPropsFactory = (_mode: 'picker' | 'canvas'): NodeProps => {
  return {
    stroke: {
      enabled: false
    },
    fill: {
      enabled: false
    },
    text: {
      align: 'left',
      text: 'Text',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    }
  };
};

Text.initialConfig = { size: { w: 100, h: 10 } };

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
