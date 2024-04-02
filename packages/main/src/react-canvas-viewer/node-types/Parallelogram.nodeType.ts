import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { BaseShape, BaseShapeProps, ShapeBuilder } from '../temp/baseShape.temp.ts';

declare global {
  interface NodeProps {
    parallelogram?: {
      slant?: number;
    };
  }
}

export class ParallelogramNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('parallelogram', 'Parallelogram');
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      slant: {
        type: 'number',
        label: 'Slant',
        value: def.props.parallelogram?.slant ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.parallelogram ??= {};
            props.parallelogram.slant = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slant = def.props.parallelogram?.slant ?? 5;
    const bnd = def.bounds;

    const sr = slant / bnd.w;
    const cds = sr * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1 + cds, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1 - cds, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1 + cds, 1));

    return pathBuilder;
  }
}

export class ParallelogramComponent extends BaseShape {
  build(props: BaseShapeProps, shapeBuilder: ShapeBuilder) {
    const slant = props.nodeProps.parallelogram?.slant ?? 5;
    const boundary = new ParallelogramNodeDefinition().getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text();

    shapeBuilder.controlPoint(props.node.bounds.x + slant, props.node.bounds.y, (x, _y, uow) => {
      const distance = Math.max(0, x - props.node.bounds.x);
      if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
        props.node.updateProps(props => {
          props.parallelogram ??= {};
          props.parallelogram.slant = distance;
        }, uow);
      }
      return `Slant: ${props.node.props.parallelogram!.slant}px`;
    });
  }
}
