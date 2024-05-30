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
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface NodeProps {
    shapeProcess?: ExtraProps;
  }
}

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: Size.get(node.renderProps.shapeProcess),
    maxValue: 50,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.size ?? 10,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(props => (props.shapeProcess = { size: round(value) }), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class ProcessNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('process', 'Process', ProcessNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<ProcessNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const sizePct = Size.get(props.nodeProps.shapeProcess) / 100;

      // Draw additional shape details
      const pathBuilder = new PathBuilder(unitCoordinateSystem(bounds));

      const x1 = -1 + sizePct * 2;
      const x2 = 1 - sizePct * 2;

      pathBuilder.line(Point.of(x1, -1), Point.of(x1, 1));
      pathBuilder.line(Point.of(x2, -1), Point.of(x2, 1));

      shapeBuilder.path(pathBuilder.getPaths().all(), props.nodeProps);

      // Draw all control points
      shapeBuilder.controlPoint(Point.of(bounds.x + sizePct * bounds.w, bounds.y), ({ x }, uow) => {
        const newValue = (Math.max(0, x - bounds.x) / bounds.w) * 100;
        Size.set(newValue, props.node, uow);
        return `Size: ${Size.get(props.node.renderProps.shapeProcess)}%`;
      });
    }
  };

  getDefaultConfig() {
    return { size: { w: 100, h: 60 } };
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
