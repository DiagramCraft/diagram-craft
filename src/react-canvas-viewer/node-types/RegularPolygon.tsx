import React from 'react';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Vector } from '../../geometry/vector.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition, NodeDefinition } from '../../model/elementDefinitionRegistry.ts';
import { Diagram } from '../../model/diagram.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';

declare global {
  interface NodeProps {
    regularPolygon?: {
      numberOfSides?: number;
    };
  }
}

export const RegularPolygon = (props: Props) => {
  const path = new RegularPolygonNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        className={'svg-node__boundary svg-node'}
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
          x={path.segments[1].start.x}
          y={path.segments[1].start.y}
          def={props.node}
          diagram={props.diagram}
          onDrag={(x, y) => {
            const angle =
              Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
            const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

            props.node.props.regularPolygon ??= {};
            props.node.props.regularPolygon.numberOfSides = numberOfSides;
            return `Sides: ${numberOfSides}`;
          }}
        />
      )}
    </>
  );
};

export class RegularPolygonNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('regular-polygon', 'Regular Polygon');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const sides = def.props?.regularPolygon?.numberOfSides ?? 5;

    const theta = Math.PI / 2;
    const dTheta = (2 * Math.PI) / sides;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(0, 1));

    for (let i = 0; i < sides; i++) {
      const angle = theta - (i + 1) * dTheta;

      pathBuilder.lineTo(Point.of(Math.cos(angle), Math.sin(angle)));
    }

    return pathBuilder;
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      numberOfSides: {
        type: 'number',
        label: 'Sides',
        value: def.props?.regularPolygon?.numberOfSides ?? 5,
        onChange: (value: number) => {
          def.props.regularPolygon ??= {};
          def.props.regularPolygon.numberOfSides = value;
        }
      }
    };
  }
}

type Props = {
  def: NodeDefinition;
  node: DiagramNode;
  diagram: Diagram;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
