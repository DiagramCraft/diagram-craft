import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { CustomPropertyDefinition } from '../../model/elementDefinitionRegistry.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { BaseShape, BaseShapeProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { Vector } from '../../geometry/vector.ts';
import { Box } from '../../geometry/box.ts';

declare global {
  interface NodeProps {
    regularPolygon?: {
      numberOfSides?: number;
    };
  }
}

export class RegularPolygonNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('regular-polygon', 'Regular Polygon');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const sides = def.props.regularPolygon?.numberOfSides ?? 5;

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
        value: def.props.regularPolygon?.numberOfSides ?? 5,
        onChange: (value: number, uow: UnitOfWork) => {
          def.updateProps(props => {
            props.regularPolygon ??= {};
            props.regularPolygon.numberOfSides = value;
          }, uow);
        }
      }
    };
  }
}

export class RegularPolygonComponent extends BaseShape {
  build(props: BaseShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new RegularPolygonNodeDefinition()
      .getBoundingPathBuilder(props.node)
      .getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text();

    shapeBuilder.controlPoint(
      boundary.segments[1].start.x,
      boundary.segments[1].start.y,
      (x, y, uow) => {
        const angle =
          Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
        const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

        props.node.updateProps(props => {
          props.regularPolygon ??= {};
          props.regularPolygon.numberOfSides = numberOfSides;
        }, uow);
        return `Sides: ${numberOfSides}`;
      }
    );
  }
}
