import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseShape, BaseShapeBuildProps } from '@diagram-craft/canvas/shape/BaseShape';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  interface NodeProps {
    roundedRect?: {
      radius?: number;
    };
  }
}

export class RoundedRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('rounded-rect', 'Rounded Rectangle', RoundedRectComponent);
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

class RoundedRectComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const radius = props.nodeProps.roundedRect?.radius ?? 10;
    const boundary = new RoundedRectNodeDefinition().getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(props.node.bounds.x + radius, props.node.bounds.y, (x, _y, uow) => {
      const distance = Math.max(0, x - props.node.bounds.x);
      if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
        props.node.updateProps(props => {
          props.roundedRect ??= {};
          props.roundedRect.radius = distance;
        }, uow);
      }
      return `Radius: ${props.node.props.roundedRect!.radius}px`;
    });
  }
}
