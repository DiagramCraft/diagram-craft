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

declare global {
  interface CustomNodeProps {
    trapetzoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

registerCustomNodeDefaults('trapetzoid', { slantLeft: 5, slantRight: 5 });

export class TrapetzoidNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('trapetzoid', 'Trapetzoid', TrapetzoidComponent);
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'slantLeft',
        type: 'number',
        label: 'Slant (left)',
        value: def.renderProps.custom.trapetzoid.slantLeft,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateCustomProps('trapetzoid', props => (props.slantLeft = value), uow);
        }
      },
      {
        id: 'slantRight',
        type: 'number',
        label: 'Slant (right)',
        value: def.renderProps.custom.trapetzoid.slantRight,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateCustomProps('trapetzoid', props => (props.slantRight = value), uow);
        }
      }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slantLeft = def.renderProps.custom.trapetzoid.slantLeft;
    const slantRight = def.renderProps.custom.trapetzoid.slantRight;
    const bnd = def.bounds;

    const cdSl = (slantLeft / bnd.w) * 2;
    const cdSR = (slantRight / bnd.w) * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1 + cdSl, 1));
    pathBuilder.lineTo(Point.of(1 - cdSR, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1 + cdSl, 1));

    return pathBuilder;
  }
}

class TrapetzoidComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const slantLeft = props.nodeProps.custom.trapetzoid.slantLeft;
    const slantRight = props.nodeProps.custom.trapetzoid.slantRight;

    const boundary = new TrapetzoidNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + slantLeft, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateCustomProps('trapetzoid', props => (props.slantLeft = distance), uow);
        }
        return `Slant: ${props.node.renderProps.custom.trapetzoid.slantLeft}px`;
      }
    );

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + props.node.bounds.w - slantRight, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateCustomProps('trapetzoid', props => (props.slantRight = distance), uow);
        }
        return `Slant: ${props.node.renderProps.custom.trapetzoid.slantRight}px`;
      }
    );
  }
}
