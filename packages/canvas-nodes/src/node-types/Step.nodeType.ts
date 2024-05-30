import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface NodeProps {
    shapeStep?: ExtraProps;
  }
}

registerNodeDefaults('shapeStep', { size: 25 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.shapeStep.size,
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= node.bounds.w / 2 || value <= 0) return;
    node.updateProps(props => (props.shapeStep = { size: round(value) }), uow);
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
      const size = props.nodeProps.shapeStep.size;

      shapeBuilder.controlPoint(
        Point.of(bounds.x + size, bounds.y + bounds.h / 2),
        ({ x }, uow) => {
          const distance = Math.max(0, x - bounds.x);
          Size.set(distance, props.node, uow);
          return `Size: ${props.node.renderProps.shapeStep.size}px`;
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.shapeStep.size / def.bounds.w;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(1 - 2 * sizePct, -1));
    pathBuilder.lineTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(1 - 2 * sizePct, 1));
    pathBuilder.lineTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(-1 + 2 * sizePct, 0));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.close();

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
