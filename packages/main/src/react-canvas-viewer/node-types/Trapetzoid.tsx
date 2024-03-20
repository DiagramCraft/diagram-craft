import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition, ReactNodeProps } from '../reactNodeDefinition.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { FilledPath } from '../FilledPath.tsx';
import { NodeWrapper } from '../NodeWrapper.tsx';

declare global {
  interface NodeProps {
    trapetzoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

export const Trapetzoid = (props: Props) => {
  const slantLeft = props.node.props.trapetzoid?.slantLeft ?? 5;
  const slantRight = props.node.props.trapetzoid?.slantRight ?? 5;
  const path = new TrapetzoidNodeDefinition().getBoundingPathBuilder(props.node).getPath();

  return (
    <NodeWrapper node={props.node} path={path}>
      <FilledPath p={path} {...props} />

      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={TextPart.defaultOnChange(props.node)}
        onMouseDown={props.onMouseDown!}
      />

      {props.isSingleSelected && props.tool?.type === 'move' && (
        <>
          <ShapeControlPoint
            x={props.node.bounds.x + slantLeft}
            y={props.node.bounds.y}
            def={props.node}
            onDrag={(x, _y, uow) => {
              const distance = Math.max(0, x - props.node.bounds.x);
              if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
                props.node.updateProps(props => {
                  props.trapetzoid ??= {};
                  props.trapetzoid.slantLeft = distance;
                }, uow);
              }
              return `Slant: ${props.node.props.trapetzoid?.slantLeft}px`;
            }}
          />
          <ShapeControlPoint
            x={props.node.bounds.x + props.node.bounds.w - slantRight}
            y={props.node.bounds.y}
            def={props.node}
            onDrag={(x, _y, uow) => {
              const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
              if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
                props.node.updateProps(props => {
                  props.trapetzoid ??= {};
                  props.trapetzoid.slantRight = distance;
                }, uow);
              }
              return `Slant: ${props.node.props.trapetzoid?.slantRight}px`;
            }}
          />
        </>
      )}
    </NodeWrapper>
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
        value: def.props.trapetzoid?.slantLeft ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantLeft = value;
          }, uow);
        }
      },
      slantRight: {
        type: 'number',
        label: 'Slant (right)',
        value: def.props.trapetzoid?.slantRight ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantRight = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slantLeft = def.props.trapetzoid?.slantLeft ?? 5;
    const slantRight = def.props.trapetzoid?.slantRight ?? 5;
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

type Props = ReactNodeProps;
