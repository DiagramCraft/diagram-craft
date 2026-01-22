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
import { _p } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';

type ExtraProps = {
  jettyWidth?: number;
  jettyHeight?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlModule?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('umlModule', {
  jettyWidth: 20,
  jettyHeight: 10
});

// Custom properties ************************************************************

const propJettyWidth = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Width', 'custom.umlModule.jettyWidth', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < 50
  });

const propJettyHeight = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Height', 'custom.umlModule.jettyHeight', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < 50
  });

// NodeDefinition and Shape *****************************************************

export class UmlModuleNodeDefinition extends ShapeNodeDefinition {
  constructor(id = 'module', name = 'UML Module') {
    super(id, name, UmlModuleNodeDefinition.Shape);
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
    const width = propJettyWidth(node).value;
    const height = propJettyHeight(node).value;
    const hw = width / 2;

    const pb = new PathListBuilder().withTransform([new Translation(node.bounds)]);
    pb.moveTo(_p(hw, 0))
      .lineTo(_p(node.bounds.w, 0))
      .lineTo(_p(node.bounds.w, node.bounds.h))
      .lineTo(_p(hw, node.bounds.h))
      .lineTo(_p(hw, height * 4))
      .lineTo(_p(0, height * 4))
      .lineTo(_p(0, height * 3))
      .lineTo(_p(hw, height * 3))
      .lineTo(_p(hw, height * 2))
      .lineTo(_p(0, height * 2))
      .lineTo(_p(0, height))
      .lineTo(_p(hw, height))
      .lineTo(_p(hw, 0));

    return pb;
  }

  static Shape = class extends BaseNodeComponent<UmlModuleNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const width = propJettyWidth(props.node).value;
      const height = propJettyHeight(props.node).value;
      const hw = width / 2;

      const { h, w } = props.node.bounds;
      const b = shapeBuilder.buildBoundary();

      b.rect(hw, 0, w - hw, h);
      b.rect(0, height, width, height);
      b.rect(0, 3 * height, width, height);
      b.fillAndStroke();

      shapeBuilder.text(this);
    }
  };

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propJettyWidth(node), propJettyHeight(node)]);
  }
}
