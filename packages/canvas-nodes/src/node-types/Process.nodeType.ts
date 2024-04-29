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
    process?: {
      size?: number;
    };
  }
}

const DEFAULT_SIZE = 10;

export class ProcessNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('process', 'Process', ProcessComponent);
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      radius: {
        type: 'number',
        label: 'Size',
        value: def.props.process?.size ?? DEFAULT_SIZE,
        maxValue: 50,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= 50 || value <= 0) return;

          def.updateProps(props => {
            props.process ??= {};
            props.process.size = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const size = def.props.process?.size ?? DEFAULT_SIZE;

    const x1 = -1 + (size / 100) * 2;
    const x2 = 1 - (size / 100) * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    pathBuilder.moveTo(Point.of(x1, -1));
    pathBuilder.lineTo(Point.of(x1, 1));

    pathBuilder.moveTo(Point.of(x2, -1));
    pathBuilder.lineTo(Point.of(x2, 1));

    return pathBuilder;
  }
}

class ProcessComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new ProcessNodeDefinition().getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);

    const size = props.nodeProps.process?.size ?? DEFAULT_SIZE;
    const bounds = props.node.bounds;
    shapeBuilder.controlPoint(
      props.node.bounds.x + (size / 100) * props.node.bounds.w,
      props.node.bounds.y,
      (x, _y, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2) {
          props.node.updateProps(props => {
            props.process ??= {};
            props.process.size = (distance / bounds.w) * 100;
          }, uow);
        }
        return `Size: ${props.node.props.process!.size}px`;
      }
    );
  }
}
