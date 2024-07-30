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
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';

declare global {
  interface CustomNodeProps {
    roundedRect?: {
      radius?: number;
    };
  }
}

registerCustomNodeDefaults('roundedRect', {
  radius: 5
});

export class RoundedRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('rounded-rect', 'Rounded Rectangle', RoundedRectComponent);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: Point.of(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: Point.of(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: Point.of(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: Point.of(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'radius',
        type: 'number',
        label: 'Radius',
        value: def.renderProps.custom.roundedRect.radius,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;

          def.updateCustomProps('roundedRect', props => (props.radius = value), uow);
        }
      }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const radius = def.renderProps.custom.roundedRect.radius;
    const bnd = def.bounds;

    const xr = (2 * radius) / bnd.w;
    const yr = (2 * radius) / bnd.h;
    const cdx = 1 - xr;
    const cdy = 1 - yr;

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

export class RoundedRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const radius = props.nodeProps.custom.roundedRect?.radius ?? 10;
    const boundary = new RoundedRectNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + radius, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateCustomProps('roundedRect', props => (props.radius = distance), uow);
        }
        return `Radius: ${props.node.renderProps.custom.roundedRect!.radius}px`;
      }
    );
  }
}
