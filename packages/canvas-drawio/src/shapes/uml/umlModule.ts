// NodeProps extension for custom props *****************************************

import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, translateCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { _p } from '@diagram-craft/geometry/point';

type ExtraProps = {
  jettyWidth?: number;
  jettyHeight?: number;
};

declare global {
  interface CustomNodeProps {
    umlModule?: ExtraProps;
  }
}

registerCustomNodeDefaults('umlModule', {
  jettyWidth: 20,
  jettyHeight: 10
});

// Custom properties ************************************************************

const JettyWidth = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'jettyWidth',
    label: 'Width',
    type: 'number',
    value: JettyWidth.get(node.renderProps.custom.umlModule),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => JettyWidth.set(value, node, uow)
  }),

  get: (props: NodePropsForRendering['custom']['umlModule']): number => props.jettyWidth,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateCustomProps('umlModule', props => (props.jettyWidth = round(value)), uow);
  }
};

const JettyHeight = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'jettyHeight',
    label: 'Height',
    type: 'number',
    value: JettyHeight.get(node.renderProps.custom.umlModule),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => JettyHeight.set(value, node, uow)
  }),

  get: (props: NodePropsForRendering['custom']['umlModule']) => props.jettyHeight,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateCustomProps('umlModule', props => (props.jettyHeight = round(value)), uow);
  }
};

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
    const width = JettyWidth.get(node.renderProps.custom.umlModule);
    const height = JettyHeight.get(node.renderProps.custom.umlModule);
    const hw = width / 2;

    const pb = new PathBuilder(translateCoordinateSystem(node.bounds));
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
      const width = JettyWidth.get(props.nodeProps.custom.umlModule);
      const height = JettyHeight.get(props.nodeProps.custom.umlModule);
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

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [JettyWidth.definition(node), JettyHeight.definition(node)];
  }
}
