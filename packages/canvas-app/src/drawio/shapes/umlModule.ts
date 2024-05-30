// NodeProps extension for custom props *****************************************

import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';

type ExtraProps = {
  jettyWidth?: number;
  jettyHeight?: number;
};

declare global {
  interface NodeProps {
    shapeUmlModule?: ExtraProps;
  }
}

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

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.jettyWidth ?? 20,

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

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.jettyHeight ?? 10,

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
      const bounds = props.node.bounds;

      shapeBuilder.boundaryPath(
        this.def.getBoundingPathBuilder(props.node).getPaths().all(),
        undefined,
        '1',
        {
          style: {
            stroke: 'transparent',
            fill: 'transparent'
          }
        }
      );

      const width = JettyWidth.get(props.nodeProps.shapeUmlModule);
      const height = JettyHeight.get(props.nodeProps.shapeUmlModule);

      const body = new PathBuilder();
      PathBuilderHelper.rect(body, {
        ...bounds,
        w: bounds.w - width / 2,
        x: bounds.x + width / 2
      });
      shapeBuilder.path(body.getPaths().all());

      const b1 = new PathBuilder();
      PathBuilderHelper.rect(b1, {
        x: bounds.x,
        y: bounds.y + height,
        w: width,
        h: height,
        r: bounds.r
      });
      shapeBuilder.path(b1.getPaths().all());

      const b2 = new PathBuilder();
      PathBuilderHelper.rect(b2, {
        x: bounds.x,
        y: bounds.y + 3 * height,
        w: width,
        h: height,
        r: bounds.r
      });
      shapeBuilder.path(b2.getPaths().all());

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
