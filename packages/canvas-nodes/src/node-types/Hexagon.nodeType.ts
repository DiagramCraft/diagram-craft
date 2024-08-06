import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface CustomNodeProps {
    hexagon?: ExtraProps;
  }
}

registerCustomNodeDefaults('hexagon', { size: 25 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.hexagon.size,
    maxValue: 50,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateCustomProps('hexagon', props => (props.size = round(value)), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class HexagonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('hexagon', 'Hexagon', HexagonNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<HexagonNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const sizePct = props.nodeProps.custom.hexagon.size / 100;

      shapeBuilder.controlPoint(Point.of(bounds.x + sizePct * bounds.w, bounds.y), ({ x }, uow) => {
        const distance = Math.max(0, x - bounds.x);
        Size.set((distance / bounds.w) * 100, props.node, uow);
        return `Size: ${props.node.renderProps.custom.hexagon.size}%`;
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.custom.hexagon.size / 100;

    const x1 = sizePct;
    const x2 = 1 - sizePct;

    return new PathBuilder(unitCoordinateSystem(def.bounds))
      .moveTo(_p(x1, 0))
      .lineTo(_p(x2, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(x2, 1))
      .lineTo(_p(x1, 1))
      .lineTo(_p(0, 0.5))
      .close();
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
