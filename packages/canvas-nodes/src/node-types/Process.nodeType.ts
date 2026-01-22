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
import { withAdjustedProperties } from '@diagram-craft/model/diagramProps';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      process?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('process', { size: 10 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Size', 'custom.process.size', {
    maxValue: 50,
    unit: '%',
    format: round,
    validate: v => v > 0 && v < 50
  });

// NodeDefinition and Shape *****************************************************

export class ProcessNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('process', 'Process', ProcessNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<ProcessNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const sizePct = props.nodeProps.custom.process.size / 100;

      // Draw additional shape details
      const pathBuilder = new PathListBuilder()
        .withTransform(fromUnitLCS(bounds))
        .line(_p(sizePct, 0), _p(sizePct, 1))
        .line(_p(1 - sizePct, 0), _p(1 - sizePct, 1));

      shapeBuilder.path(
        pathBuilder.getPaths().all(),
        withAdjustedProperties(props.nodeProps, p => {
          p.shadow.enabled = false;
        })
      );

      // Draw all control points
      shapeBuilder.controlPoint(_p(bounds.x + sizePct * bounds.w, bounds.y), ({ x }, uow) => {
        const newValue = (Math.max(0, x - bounds.x) / bounds.w) * 100;
        propSize(props.node).onChange(newValue, uow);
        return `Size: ${props.node.renderProps.custom.process.size}%`;
      });
    }
  };

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propSize(node)]);
  }
}
