import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Box } from '@diagram-craft/geometry/box';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  doubleBorder?: boolean;
  doubleBorderGap?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      rect?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('rect', {
  doubleBorder: false,
  doubleBorderGap: 5
});

// Custom properties ************************************************************

const propDoubleBorder = (node: DiagramNode) =>
  CustomProperty.node.boolean(node, 'Double Border', 'custom.rect.doubleBorder');

const propDoubleBorderGap = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Double Border Gap', 'custom.rect.doubleBorderGap', {
    minValue: 1,
    maxValue: 50,
    unit: 'px'
  });

// NodeDefinition and Shape *****************************************************

export class RectNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'rect', displayName = 'Rectangle') {
    super(name, displayName, RectComponent);
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propDoubleBorder(node), propDoubleBorderGap(node)]);
  }
}

class RectComponent extends BaseNodeComponent<RectNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    super.buildShape(props, shapeBuilder);

    const doubleBorder = props.nodeProps.custom.rect.doubleBorder;
    if (doubleBorder) {
      const gap = props.nodeProps.custom.rect.doubleBorderGap;
      const innerBounds = Box.grow(props.node.bounds, -gap);

      const b = new PathListBuilder();
      PathBuilderHelper.rect(b, innerBounds);

      shapeBuilder.path(b.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }
  }
}
