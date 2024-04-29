import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseShape, BaseShapeBuildProps } from '@diagram-craft/canvas/shape/BaseShape';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface NodeProps {
    hexagon?: ExtraProps;
  }
}

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: Size.get(node.props.hexagon),
    maxValue: 50,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.size ?? 25,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(props => (props.hexagon = { size: round(value) }), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class HexagonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('hexagon', 'Hexagon', HexagonNodeDefinition.Shape);
  }

  static Shape = class extends BaseShape<HexagonNodeDefinition> {
    buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const sizePct = Size.get(props.nodeProps.hexagon) / 100;

      shapeBuilder.controlPoint(Point.of(bounds.x + sizePct * bounds.w, bounds.y), ({ x }, uow) => {
        const distance = Math.max(0, x - bounds.x);
        Size.set((distance / bounds.w) * 100, props.node, uow);
        return `Size: ${Size.get(props.node.props.hexagon)}%`;
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = Size.get(def.props.hexagon) / 100;

    const x1 = -1 + sizePct * 2;
    const x2 = 1 - sizePct * 2;

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

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
