import { ShapeControlPoint } from '../ShapeControlPoint.tsx';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition, ReactNodeProps } from '../reactNodeDefinition.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { NodeWrapper } from '../NodeWrapper.tsx';
import { FilledPath } from '../FilledPath.tsx';

declare global {
  interface NodeProps {
    roundedRect?: {
      radius?: number;
    };
  }
}

export const RoundedRect = (props: Props) => {
  const radius = props.node.props.roundedRect?.radius ?? 10;
  const path = new RoundedRectNodeDefinition().getBoundingPathBuilder(props.node).getPath();

  return (
    <>
      <NodeWrapper {...props} node={props.node} path={path}>
        <FilledPath p={path} {...props} />

        <TextPart
          id={`text_1_${props.node.id}`}
          text={props.nodeProps.text}
          bounds={props.node.bounds}
          onChange={TextPart.defaultOnChange(props.node)}
          onMouseDown={props.onMouseDown!}
        />
      </NodeWrapper>

      {props.isSingleSelected && props.tool?.type === 'move' && (
        <ShapeControlPoint
          x={props.node.bounds.x + radius}
          y={props.node.bounds.y}
          def={props.node}
          onDrag={(x, _y, uow) => {
            const distance = Math.max(0, x - props.node.bounds.x);
            if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
              props.node.updateProps(props => {
                props.roundedRect ??= {};
                props.roundedRect.radius = distance;
              }, uow);
            }
            return `Radius: ${props.node.props.roundedRect!.radius}px`;
          }}
        />
      )}
    </>
  );
};

export class RoundedRectNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('rounded-rect', 'Rounded Rectangle');
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      radius: {
        type: 'number',
        label: 'Radius',
        value: def.props.roundedRect?.radius ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;

          def.updateProps(props => {
            props.roundedRect ??= {};
            props.roundedRect.radius = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const radius = def.props.roundedRect?.radius ?? 5;
    const bnd = def.bounds;

    const xr = radius / bnd.w;
    const yr = radius / bnd.h;
    const cdx = 1 - 2 * xr;
    const cdy = 1 - 2 * yr;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-cdx, 1));
    pathBuilder.lineTo(Point.of(cdx, 1));
    pathBuilder.arcTo(Point.of(1, cdy), xr, yr, 0, 0, 1);
    pathBuilder.lineTo(Point.of(1, -cdy));
    pathBuilder.arcTo(Point.of(cdx, -1), xr, yr, 0, 0, 1);
    pathBuilder.lineTo(Point.of(-cdx, -1));
    pathBuilder.arcTo(Point.of(-1, -cdy), xr, yr, 0, 0, 1);
    pathBuilder.lineTo(Point.of(-1, cdy));
    pathBuilder.arcTo(Point.of(-cdx, 1), xr, yr, 0, 0, 1);

    return pathBuilder;
  }
}

type Props = ReactNodeProps;
