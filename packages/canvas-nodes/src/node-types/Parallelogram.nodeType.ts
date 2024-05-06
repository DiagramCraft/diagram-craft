import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  interface NodeProps {
    parallelogram?: {
      slant?: number;
    };
  }
}

export class ParallelogramNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('parallelogram', 'Parallelogram', ParallelogramComponent);
  }

  getCustomProperties(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'slant',
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
    ];
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

class ParallelogramComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const slant = props.nodeProps.parallelogram?.slant ?? 5;
    const boundary = new ParallelogramNodeDefinition()
      .getBoundingPathBuilder(props.node)
      .getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + slant, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateProps(props => {
            props.parallelogram ??= {};
            props.parallelogram.slant = distance;
          }, uow);
        }
        return `Slant: ${props.node.props.parallelogram!.slant}px`;
      }
    );
  }
}
