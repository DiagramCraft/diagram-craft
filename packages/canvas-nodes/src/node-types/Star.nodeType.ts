import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';

declare global {
  interface NodeProps {
    star?: {
      numberOfSides?: number;
      innerRadius?: number;
    };
  }
}

export class StarNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('star', 'Star', StarComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const sides = def.props.star?.numberOfSides ?? 5;
    const innerRadius = def.props.star?.innerRadius ?? 0.5;

    const theta = Math.PI / 2;
    const dTheta = (2 * Math.PI) / sides;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(0, 1));

    for (let i = 0; i < sides; i++) {
      const angle = theta - (i + 1) * dTheta;

      const iAngle = angle + dTheta / 2;
      pathBuilder.lineTo(Point.of(Math.cos(iAngle) * innerRadius, Math.sin(iAngle) * innerRadius));

      pathBuilder.lineTo(Point.of(Math.cos(angle), Math.sin(angle)));
    }

    return pathBuilder;
  }

  getCustomProperties(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'numberOfSides',
        type: 'number',
        label: 'Sides',
        value: def.props.star?.numberOfSides ?? 5,
        onChange: (value: number, uow: UnitOfWork) => {
          def.updateProps(props => {
            props.star ??= {};
            props.star.numberOfSides = value;
          }, uow);
        }
      },
      {
        id: 'innerRadius',
        type: 'number',
        label: 'Radius',
        value: round((def.props.star?.innerRadius ?? 0.5) * 100),
        maxValue: 100,
        unit: '%',
        onChange: (value: number, uow: UnitOfWork) => {
          def.updateProps(props => {
            props.star ??= {};
            props.star.innerRadius = value / 100;
          }, uow);
        }
      }
    ];
  }
}

class StarComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new StarNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    const path = boundary.singularPath();

    shapeBuilder.controlPoint(path.segments[1].start, ({ x, y }, uow) => {
      const distance = Point.distance({ x, y }, Box.center(props.node.bounds));
      props.node.updateProps(p => {
        p.star ??= {};
        p.star.innerRadius = distance / (props.node.bounds.w / 2);
      }, uow);
      return `Inner radius: ${round(props.node.props.star!.innerRadius! * 100)}%`;
    });

    shapeBuilder.controlPoint(path.segments[2].start, ({ x, y }, uow) => {
      const angle =
        Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
      const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

      props.node.updateProps(props => {
        props.star ??= {};
        props.star.numberOfSides = numberOfSides;
      }, uow);

      return `Sides: ${numberOfSides}`;
    });
  }
}
