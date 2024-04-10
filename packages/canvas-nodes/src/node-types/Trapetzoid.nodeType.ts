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
    trapetzoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

export class TrapetzoidNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('trapetzoid', 'Trapetzoid', () => new TrapetzoidComponent(this));
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      slantLeft: {
        type: 'number',
        label: 'Slant (left)',
        value: def.props.trapetzoid?.slantLeft ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantLeft = value;
          }, uow);
        }
      },
      slantRight: {
        type: 'number',
        label: 'Slant (right)',
        value: def.props.trapetzoid?.slantRight ?? 5,
        maxValue: 60,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
          def.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantRight = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const slantLeft = def.props.trapetzoid?.slantLeft ?? 5;
    const slantRight = def.props.trapetzoid?.slantRight ?? 5;
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

class TrapetzoidComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const slantLeft = props.nodeProps.trapetzoid?.slantLeft ?? 5;
    const slantRight = props.nodeProps.trapetzoid?.slantRight ?? 5;

    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      props.node.bounds.x + slantLeft,
      props.node.bounds.y,
      (x, _y, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantLeft = distance;
          }, uow);
        }
        return `Slant: ${props.node.props.trapetzoid?.slantLeft}px`;
      }
    );

    shapeBuilder.controlPoint(
      props.node.bounds.x + props.node.bounds.w - slantRight,
      props.node.bounds.y,
      (x, _y, uow) => {
        const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateProps(props => {
            props.trapetzoid ??= {};
            props.trapetzoid.slantRight = distance;
          }, uow);
        }
        return `Slant: ${props.node.props.trapetzoid?.slantRight}px`;
      }
    );
  }
}
