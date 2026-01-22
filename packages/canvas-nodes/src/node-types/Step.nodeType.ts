import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
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
      step?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('step', { size: 25 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Size', 'custom.step.size', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < node.bounds.w / 2
  });

// NodeDefinition and Shape *****************************************************

export class StepNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('step', 'Step', StepNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<StepNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const size = props.nodeProps.custom.step.size;

      shapeBuilder.controlPoint(_p(bounds.x + size, bounds.y + bounds.h / 2), ({ x }, uow) => {
        propSize(props.node).set(Math.max(0, x - bounds.x), uow);
        return `Size: ${props.node.renderProps.custom.step.size}px`;
      });
    }
  };

  /*
      |--| size
         |
      0----------------1
       \ |              \
        \                \
         5                2
        /                /
       /                /
      4----------------3

   */
  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.custom.step.size / def.bounds.w;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1 - sizePct, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(1 - sizePct, 1))
      .lineTo(_p(0, 1))
      .lineTo(_p(sizePct, 0.5))
      .lineTo(_p(0, 0));
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propSize(node)]);
  }
}
