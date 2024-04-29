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
    hexagon?: {
      size?: number;
    };
  }
}

const DEFAULT_SIZE = 25;

export class HexagonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('hexagon', 'Hexagon', HexagonComponent);
  }

  getCustomProperties(def: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      radius: {
        type: 'number',
        label: 'Size',
        value: def.props.hexagon?.size ?? DEFAULT_SIZE,
        maxValue: 50,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          if (value >= 50 || value <= 0) return;

          def.updateProps(props => {
            props.hexagon ??= {};
            props.hexagon.size = value;
          }, uow);
        }
      }
    };
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const size = def.props.hexagon?.size ?? DEFAULT_SIZE;

    const x1 = -1 + (size / 100) * 2;
    const x2 = 1 - (size / 100) * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(x2, 1));
    pathBuilder.lineTo(Point.of(x1, 1));
    pathBuilder.lineTo(Point.of(-1, 0));
    pathBuilder.lineTo(Point.of(x1, -1));
    pathBuilder.lineTo(Point.of(x2, -1));
    pathBuilder.close();

    return pathBuilder;
  }
}

class HexagonComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const size = props.nodeProps.hexagon?.size ?? DEFAULT_SIZE;
    const boundary = new HexagonNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);

    const bounds = props.node.bounds;
    shapeBuilder.controlPoint(
      props.node.bounds.x + (size / 100) * props.node.bounds.w,
      props.node.bounds.y,
      (x, _y, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2) {
          props.node.updateProps(props => {
            props.hexagon ??= {};
            props.hexagon.size = (distance / bounds.w) * 100;
          }, uow);
        }
        return `Size: ${props.node.props.hexagon!.size}px`;
      }
    );
  }
}
