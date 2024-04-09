import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition.ts';
import { DiagramNode } from '@diagram-craft/model';
import { CustomPropertyDefinition } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { round } from '@diagram-craft/utils';
import { BaseShape, BaseShapeBuildProps } from '../shape/BaseShape.ts';
import { Box, PathBuilder, Point, unitCoordinateSystem, Vector } from '@diagram-craft/geometry';
import { ShapeBuilder } from '../shape/ShapeBuilder.ts';

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
    super('star', 'Star', () => new StarComponent(this));
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

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      numberOfSides: {
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
      innerRadius: {
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
    };
  }
}

class StarComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      boundary.segments[1].start.x,
      boundary.segments[1].start.y,
      (x, y, uow) => {
        const distance = Point.distance({ x, y }, Box.center(props.node.bounds));
        props.node.updateProps(p => {
          p.star ??= {};
          p.star.innerRadius = distance / (props.node.bounds.w / 2);
        }, uow);
        return `Inner radius: ${round(props.node.props.star!.innerRadius! * 100)}%`;
      }
    );

    shapeBuilder.controlPoint(
      boundary.segments[2].start.x,
      boundary.segments[2].start.y,
      (x, y, uow) => {
        const angle =
          Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
        const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

        props.node.updateProps(props => {
          props.star ??= {};
          props.star.numberOfSides = numberOfSides;
        }, uow);

        return `Sides: ${numberOfSides}`;
      }
    );
  }
}
