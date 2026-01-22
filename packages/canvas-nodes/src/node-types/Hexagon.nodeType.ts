import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      hexagon?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('hexagon', { size: 25 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Size', 'custom.hexagon.size', {
    maxValue: 50,
    unit: '%',
    format: round,
    validate: v => v > 0 && v < 50
  });

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
        propSize(props.node).set((Math.max(0, x - bounds.x) / bounds.w) * 100, uow);
        return `Size: ${props.node.renderProps.custom.hexagon.size}%`;
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.custom.hexagon.size / 100;

    const x1 = sizePct;
    const x2 = 1 - sizePct;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(x1, 0)
      .lineTo(x2, 0)
      .lineTo(1, 0.5)
      .lineTo(x2, 1)
      .lineTo(x1, 1)
      .lineTo(0, 0.5)
      .close();
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propSize(node)]);
  }
}
