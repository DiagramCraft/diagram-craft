import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { round } from '@diagram-craft/utils/math';

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
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
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
        isSet: def.storedProps.custom?.roundedRect?.radius !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('roundedRect', props => (props.radius = undefined), uow);
          } else {
            if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;

            def.updateCustomProps('roundedRect', props => (props.radius = value), uow);
          }
        }
      }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = node.renderProps.custom.roundedRect.radius;
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }
}

export class RoundedRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new RoundedRectNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );
    shapeBuilder.text(this);

    const radius = props.nodeProps.custom.roundedRect?.radius ?? 10;
    shapeBuilder.controlPoint(_p(props.node.bounds.x + radius, props.node.bounds.y), (p, uow) => {
      const rotatedCorner = Point.rotateAround(
        props.node.bounds,
        props.node.bounds.r,
        Box.center(props.node.bounds)
      );
      const distance = Math.max(0, p.x - rotatedCorner.x);
      if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
        props.node.updateCustomProps('roundedRect', props => (props.radius = distance), uow);
      }
      return `Radius: ${round(props.node.renderProps.custom.roundedRect!.radius)}px`;
    });
  }
}
