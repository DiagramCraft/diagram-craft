import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  interface NodeProps {
    regularPolygon?: {
      numberOfSides?: number;
    };
  }
}

export class RegularPolygonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('regular-polygon', 'Regular Polygon', RegularPolygonComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const sides = def.renderProps.regularPolygon?.numberOfSides ?? 5;

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

  getCustomProperties(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'numberOfSides',
        type: 'number',
        label: 'Sides',
        value: def.renderProps.regularPolygon?.numberOfSides ?? 5,
        onChange: (value: number, uow: UnitOfWork) => {
          def.updateProps(props => {
            props.regularPolygon ??= {};
            props.regularPolygon.numberOfSides = value;
          }, uow);
        }
      }
    ];
  }
}

class RegularPolygonComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new RegularPolygonNodeDefinition()
      .getBoundingPathBuilder(props.node)
      .getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    const path = boundary.singularPath();

    shapeBuilder.controlPoint(path.segments[1].start, ({ x, y }, uow) => {
      const angle =
        Math.PI / 2 + Vector.angle(Point.subtract({ x, y }, Box.center(props.node.bounds)));
      const numberOfSides = Math.min(100, Math.max(4, Math.ceil((Math.PI * 2) / angle)));

      props.node.updateProps(props => {
        props.regularPolygon ??= {};
        props.regularPolygon.numberOfSides = numberOfSides;
      }, uow);
      return `Sides: ${numberOfSides}`;
    });
  }
}
