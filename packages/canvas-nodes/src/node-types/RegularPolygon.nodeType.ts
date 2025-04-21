import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

declare global {
  interface CustomNodeProps {
    regularPolygon?: {
      numberOfSides?: number;
    };
  }
}

registerCustomNodeDefaults('regularPolygon', { numberOfSides: 5 });

export class RegularPolygonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('regular-polygon', 'Regular Polygon', RegularPolygonComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const sides = def.renderProps.custom.regularPolygon.numberOfSides;

    const start = -Math.PI / 2;
    const dTheta = (2 * Math.PI) / sides;

    const pathBuilder = new PathListBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(_p(0.5, 0));

    for (let i = 0; i < sides; i++) {
      const angle = start + (i + 1) * dTheta;

      pathBuilder.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(angle, 0.5)));
    }

    return pathBuilder;
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'numberOfSides',
        type: 'number',
        label: 'Sides',
        value: def.renderProps.custom.regularPolygon.numberOfSides,
        isSet: def.storedProps.custom?.regularPolygon?.numberOfSides !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          def.updateCustomProps('regularPolygon', props => (props.numberOfSides = value), uow);
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

      props.node.updateCustomProps(
        'regularPolygon',
        props => (props.numberOfSides = numberOfSides),
        uow
      );
      return `Sides: ${numberOfSides}`;
    });
  }
}
