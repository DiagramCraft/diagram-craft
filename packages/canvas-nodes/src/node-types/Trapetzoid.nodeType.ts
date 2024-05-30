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

declare global {
  interface NodeProps {
    shapeTrapetzoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

export class TrapetzoidNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('trapetzoid', 'Trapetzoid', TrapetzoidComponent);
  }

  getCustomProperties(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'slantLeft',
        type: 'number',
        label: 'Slant (left)',
        value: def.renderProps.shapeTrapetzoid?.slantLeft ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.shapeTrapetzoid ??= {};
            props.shapeTrapetzoid.slantLeft = value;
          }, uow);
        }
      },
      {
        id: 'slantRight',
        type: 'number',
        label: 'Slant (right)',
        value: def.renderProps.shapeTrapetzoid?.slantRight ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.shapeTrapetzoid ??= {};
            props.shapeTrapetzoid.slantRight = value;
          }, uow);
        }
      }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slantLeft = def.renderProps.shapeTrapetzoid?.slantLeft ?? 5;
    const slantRight = def.renderProps.shapeTrapetzoid?.slantRight ?? 5;
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
    const slantLeft = props.nodeProps.shapeTrapetzoid?.slantLeft ?? 5;
    const slantRight = props.nodeProps.shapeTrapetzoid?.slantRight ?? 5;

    const boundary = new TrapetzoidNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + slantLeft, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateProps(props => {
            props.shapeTrapetzoid ??= {};
            props.shapeTrapetzoid.slantLeft = distance;
          }, uow);
        }
        return `Slant: ${props.node.renderProps.shapeTrapetzoid?.slantLeft}px`;
      }
    );

    shapeBuilder.controlPoint(
      Point.of(props.node.bounds.x + props.node.bounds.w - slantRight, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateProps(props => {
            props.shapeTrapetzoid ??= {};
            props.shapeTrapetzoid.slantRight = distance;
          }, uow);
        }
        return `Slant: ${props.node.renderProps.shapeTrapetzoid?.slantRight}px`;
      }
    );
  }
}
