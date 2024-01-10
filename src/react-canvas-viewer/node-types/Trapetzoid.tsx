import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { Diagram } from '../../model/diagram.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';

declare global {
  interface NodeProps {
    trapetzoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

export const Trapetzoid = (props: Props) => {
  const slantLeft = props.node.props?.trapetzoid?.slantLeft ?? 5;
  const slantRight = props.node.props?.trapetzoid?.slantRight ?? 5;
  const path = new TrapetzoidNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
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
        <>
          <ShapeControlPoint
            x={props.node.bounds.x + slantLeft}
            y={props.node.bounds.y}
            def={props.node}
            onDrag={x => {
              const distance = Math.max(0, x - props.node.bounds.x);
              props.node.props.trapetzoid ??= {};
              if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
                props.node.props.trapetzoid.slantLeft = distance;
              }
              return `Slant: ${props.node.props.trapetzoid.slantLeft}px`;
            }}
          />
          <ShapeControlPoint
            x={props.node.bounds.x + props.node.bounds.w - slantRight}
            y={props.node.bounds.y}
            def={props.node}
            onDrag={x => {
              const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
              props.node.props.trapetzoid ??= {};
              if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
                props.node.props.trapetzoid.slantRight = distance;
              }
              return `Slant: ${props.node.props.trapetzoid.slantRight}px`;
            }}
          />
        </>
      )}
    </>
  );
};

export class TrapetzoidNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('trapetzoid', 'Trapetzoid');
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      slantLeft: {
        type: 'number',
        label: 'Slant (left)',
        value: def.props?.trapetzoid?.slantLeft ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number) => {
          def.props.trapetzoid ??= {};
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.props.trapetzoid.slantLeft = value;
        }
      },
      slantRight: {
        type: 'number',
        label: 'Slant (right)',
        value: def.props?.trapetzoid?.slantRight ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number) => {
          def.props.trapetzoid ??= {};
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.props.trapetzoid.slantRight = value;
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slantLeft = def.props?.trapetzoid?.slantLeft ?? 5;
    const slantRight = def.props?.trapetzoid?.slantRight ?? 5;
    const bnd = def.bounds;

    const cdSl = (slantLeft / bnd.w) * 2;
    const cdSR = (slantRight / bnd.w) * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1 + cdSl, 1));
    pathBuilder.lineTo(Point.of(1 - cdSR, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1 + cdSl, 1));

    return pathBuilder;
  }
}

type Props = {
  node: DiagramNode;
  diagram: Diagram;
  nodeProps: NodeProps;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;
