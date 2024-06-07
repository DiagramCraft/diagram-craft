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
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';

type ExtraProps = {
  jettyWidth?: number;
  jettyHeight?: number;
};

declare global {
  interface NodeProps {
    shapeUmlModule?: ExtraProps;
  }
}

registerNodeDefaults('shapeUmlModule', {
  jettyWidth: 20,
  jettyHeight: 10
});

// Custom properties ************************************************************

const JettyWidth = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'jettyWidth',
    label: 'Width',
    type: 'number',
    value: JettyWidth.get(node.renderProps.shapeUmlModule),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => JettyWidth.set(value, node, uow)
  }),

  get: (props: NodePropsForRendering['shapeUmlModule']): number => props.jettyWidth,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(
      props => (props.shapeUmlModule = { ...props.shapeUmlModule, jettyWidth: round(value) }),
      uow
    );
  }
};

const JettyHeight = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'jettyHeight',
    label: 'Height',
    type: 'number',
    value: JettyHeight.get(node.renderProps.shapeUmlModule),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => JettyHeight.set(value, node, uow)
  }),

  get: (props: NodePropsForRendering['shapeUmlModule']) => props.jettyHeight,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(
      props => (props.shapeUmlModule = { ...props.shapeUmlModule, jettyHeight: round(value) }),
      uow
    );
  }
};

// NodeDefinition and Shape *****************************************************

export class UmlModuleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('module', 'UML Module', UmlModuleNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<UmlModuleNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      // TODO: Fix these type conversions
      const width = JettyWidth.get(
        props.nodeProps.shapeUmlModule as NodePropsForRendering['shapeUmlModule']
      );
      const height = JettyHeight.get(
        props.nodeProps.shapeUmlModule as NodePropsForRendering['shapeUmlModule']
      );

      const { h, w } = props.node.bounds;
      const b = shapeBuilder.buildBoundary();

      b.rect(width / 2, 0, w - width / 2, h);
      b.rect(0, height, width, height);
      b.rect(0, 3 * height, width, height);
      b.fillAndStroke();

      shapeBuilder.text(this);
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder();
    PathBuilderHelper.rect(pathBuilder, def.bounds);
    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [JettyWidth.definition(node), JettyHeight.definition(node)];
  }
}
