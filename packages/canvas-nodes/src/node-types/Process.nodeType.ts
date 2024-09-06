import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { withAdjustedProperties } from '@diagram-craft/model/diagramProps';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface CustomNodeProps {
    process?: ExtraProps;
  }
}

registerCustomNodeDefaults('process', { size: 10 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.process.size,
    maxValue: 50,
    unit: '%',
    isSet: node.storedProps.custom?.process?.size !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('process', props => (props.size = undefined), uow);
    } else {
      if (value >= 50 || value <= 0) return;
      node.updateCustomProps('process', props => (props.size = round(value)), uow);
    }
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
      const sizePct = props.nodeProps.custom.process.size / 100;

      // Draw additional shape details
      const pathBuilder = new PathBuilder(unitCoordinateSystem(bounds))
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
        Size.set(newValue, props.node, uow);
        return `Size: ${props.node.renderProps.custom.process.size}%`;
      });
    }
  };

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
