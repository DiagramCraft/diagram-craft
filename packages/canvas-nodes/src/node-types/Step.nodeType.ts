import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
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
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      step?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('step', { size: 25 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.step.size,
    maxValue: 50,
    unit: 'px',
    isSet: node.storedProps.custom?.step?.size !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('step', props => (props.size = undefined), uow);
    } else {
      if (value >= node.bounds.w / 2 || value <= 0) return;
      node.updateCustomProps('step', props => (props.size = round(value)), uow);
    }
  }
};

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
        const distance = Math.max(0, x - bounds.x);
        Size.set(distance, props.node, uow);
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

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
