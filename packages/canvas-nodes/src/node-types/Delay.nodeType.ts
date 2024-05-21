import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export class DelayNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('delay', 'Delay', DelayComponent);
  }

  getCustomProperties(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'radius',
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
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const bnd = def.bounds;

    const xr = bnd.h / bnd.w;
    const yr = 1;
    const cdx = 1 - xr;
    const cdy = 1 - yr;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(cdx, 1));
    pathBuilder.arcTo(Point.of(1, cdy), xr, yr, 0, 0, 1);
    pathBuilder.lineTo(Point.of(1, -cdy));
    pathBuilder.arcTo(Point.of(cdx, -1), xr, yr, 0, 0, 1);
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }
}

class DelayComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DelayNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }
}
