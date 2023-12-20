import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { Diagram } from '../../model/diagram.ts';
import { PathBuilder } from '../../geometry/pathBuilder.ts';

declare global {
  interface NodeProps {
    roundedRect?: {
      radius?: number;
    };
  }
}

export const RoundedRect = (props: Props) => {
  const radius = props.node.props?.roundedRect?.radius ?? 10;
  const path = RoundedRect.getBoundingPath(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
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
            if (
              distance >= props.node.bounds.size.w / 2 ||
              distance >= props.node.bounds.size.h / 2
            )
              return;
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
        if (value >= def.bounds.size.w / 2 || value >= def.bounds.size.h / 2) return;
        def.props.roundedRect.radius = value;
      }
    }
  };
};

RoundedRect.getBoundingPath = (def: DiagramNode) => {
  const pathBuilder = new PathBuilder();

  const radius = def.props?.roundedRect?.radius ?? 10;

  const bnd = def.bounds;

  const cdx = 1 - (2 * radius) / bnd.size.w;
  const cdy = 1 - (2 * radius) / bnd.size.h;

  const bn0 = pathBuilder.toWorldCoordinate(bnd, -cdx, 1);
  const bn1 = pathBuilder.toWorldCoordinate(bnd, cdx, 1);
  const be0 = pathBuilder.toWorldCoordinate(bnd, 1, cdy);
  const be1 = pathBuilder.toWorldCoordinate(bnd, 1, -cdy);
  const bs0 = pathBuilder.toWorldCoordinate(bnd, cdx, -1);
  const bs1 = pathBuilder.toWorldCoordinate(bnd, -cdx, -1);
  const bw0 = pathBuilder.toWorldCoordinate(bnd, -1, -cdy);
  const bw1 = pathBuilder.toWorldCoordinate(bnd, -1, cdy);

  pathBuilder.moveToPoint(bn0);
  pathBuilder.lineToPoint(bn1);
  pathBuilder.arcTo(be0, radius, radius, 0, 0, 1);
  pathBuilder.lineToPoint(be1);
  pathBuilder.arcTo(bs0, radius, radius, 0, 0, 1);
  pathBuilder.lineToPoint(bs1);
  pathBuilder.arcTo(bw0, radius, radius, 0, 0, 1);
  pathBuilder.lineToPoint(bw1);
  pathBuilder.arcTo(bn0, radius, radius, 0, 0, 1);

  return pathBuilder;
};

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  nodeProps: NodeProps;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
