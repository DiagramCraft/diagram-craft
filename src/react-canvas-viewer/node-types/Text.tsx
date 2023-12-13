import React, { useCallback } from 'react';
import { TextPart } from '../TextPart.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Box } from '../../geometry/box.ts';
import { Extent } from '../../geometry/extent.ts';

export const Text = (props: Props) => {
  props.node.props.text ??= {
    text: 'Text'
  };

  const sizeChangeCallback = useCallback(
    (size: Extent) => {
      const height = size.h;
      if (height !== props.node.bounds.size.h) {
        const b = Box.asMutableSnapshot(props.node.bounds);
        b.get('size')!.h = height;
        props.node.bounds = b.getSnapshot();
      }

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
        {...propsUtils.except(props, 'node', 'isSelected', 'isSingleSelected')}
      />
      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.node.props.text}
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

Text.defaultPropsFactory = (_node: DiagramNode, _mode: 'picker' | 'canvas') => {
  return {
    stroke: {
      enabled: false,
      color: 'red'
    },
    fill: {
      enabled: false,
      color: 'red'
    }
  };
};

Text.initialConfig = { size: { w: 100, h: 10 } };

type Props = {
  node: DiagramNode;
  diagram: EditableDiagram;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
