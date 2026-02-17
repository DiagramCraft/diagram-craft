// NodeProps extension for custom props *****************************************

import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { round } from '@diagram-craft/utils/math';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Translation } from '@diagram-craft/geometry/transform';

type ExtraProps = {
  jettyWidth?: number;
  jettyHeight?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      c4Module?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('c4Module', {
  jettyWidth: 20,
  jettyHeight: 10
});

// Custom properties ************************************************************

const propJettyWidth = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Width', 'custom.c4Module.jettyWidth', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < 50
  });

const propJettyHeight = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Height', 'custom.c4Module.jettyHeight', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < 50
  });

// NodeDefinition and Shape *****************************************************

export class C4ModuleNodeDefinition extends ShapeNodeDefinition {
  constructor(id = 'c4Module', name = 'C4 Module') {
    super(id, name, C4ModuleNodeDefinition.Shape);
  }

  /*
     width
     |-----|

        0--------------------------------1   -- height
        |                                |   |
     A--B--|                             |   -- height
     |     |                             |   |
     9--8--|                             |   -- height
        |                                |   |
     6--7--|                             |   -- height
     |     |                             |   |
     5--4--|                             |   --
        |                                |
        |                                |
        |                                |
        |                                |
        |                                |
        |                                |
        3--------------------------------2
   */
  getBoundingPathBuilder(node: DiagramNode) {
    const width = propJettyWidth(node).get();
    const height = propJettyHeight(node).get();
    const hw = width / 2;
    const outerR = 8;
    const innerR = 2;

    const b = new PathListBuilder().withTransform([new Translation(node.bounds)]);

    // Outer shape with 10px rounding
    b.moveTo(hw + outerR, 0);
    b.lineTo(node.bounds.w - outerR, 0);
    b.arcTo({ x: node.bounds.w, y: outerR }, outerR, outerR, 0, 0, 1);
    b.lineTo(node.bounds.w, node.bounds.h - outerR);
    b.arcTo({ x: node.bounds.w - outerR, y: node.bounds.h }, outerR, outerR, 0, 0, 1);
    b.lineTo(hw + outerR, node.bounds.h);
    b.arcTo({ x: hw, y: node.bounds.h - outerR }, outerR, outerR, 0, 0, 1);
    b.lineTo(hw, height * 3.5);
    b.lineTo(innerR, height * 3.5);
    b.arcTo({ x: 0, y: height * 3.5 - innerR }, innerR, innerR, 0, 0, 1);
    b.lineTo(0, height * 2.5 + innerR);
    b.arcTo({ x: innerR, y: height * 2.5 }, innerR, innerR, 0, 0, 1);
    b.lineTo(hw, height * 2.5);
    b.lineTo(hw, height * 2);
    b.lineTo(innerR, height * 2);
    b.arcTo({ x: 0, y: height * 2 - innerR }, innerR, innerR, 0, 0, 1);
    b.lineTo(0, height + innerR);
    b.arcTo({ x: innerR, y: height }, innerR, innerR, 0, 0, 1);
    b.lineTo(hw, height);
    b.lineTo(hw, outerR);
    b.arcTo({ x: hw + outerR, y: 0 }, outerR, outerR, 0, 0, 1);
    b.close();

    return b;
  }

  static Shape = class extends BaseNodeComponent<C4ModuleNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const width = propJettyWidth(props.node).get();
      const height = propJettyHeight(props.node).get();
      const hw = width / 2;

      const { h, w } = props.node.bounds;
      const b = shapeBuilder.buildBoundary();

      // Outer shape with 8px rounding
      b.rect(hw, 0, w - hw, h, 8, 8);
      // Smaller boxes with 2px rounding
      b.rect(0, height, width, height, 2, 2);
      b.rect(0, 2.5 * height, width, height, 2, 2);
      b.fillAndStroke();

      shapeBuilder.text(this);
    }
  };

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propJettyWidth(node), propJettyHeight(node)]);
  }
}
