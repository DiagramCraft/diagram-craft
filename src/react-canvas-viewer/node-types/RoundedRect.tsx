import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model-viewer/nodeDefinition.ts';

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
        id={`text_1_${props.node.id}`}
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
        <ShapeControlPoint
          x={props.node.bounds.pos.x + radius}
          y={props.node.bounds.pos.y}
          diagram={props.diagram}
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

RoundedRect.getCustomProperties = (def: DiagramNode): Record<string, CustomPropertyDefinition> => {
  return {
    radius: {
      type: 'number',
      label: 'Radius',
      value: def.props?.roundedRect?.radius ?? 10,
      maxValue: 60,
      unit: 'px',
      onChange: (value: number) => {
        def.props.roundedRect ??= {};
        def.props.roundedRect.radius = value;
      }
    }
  };
};

type Props = {
  node: DiagramNode;
  diagram: EditableDiagram;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
