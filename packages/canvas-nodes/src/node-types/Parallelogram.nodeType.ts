import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

declare global {
  namespace DiagramCraft {
    interface CustomNodeProps {
      parallelogram?: {
        slant?: number;
      };
    }
  }
}

registerCustomNodeDefaults('parallelogram', { slant: 5 });

export class ParallelogramNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('parallelogram', 'Parallelogram', ParallelogramComponent);
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'slant',
        type: 'number',
        label: 'Slant',
        value: node.renderProps.custom.parallelogram.slant,
        maxValue: 60,
        unit: 'px',
        isSet: node.storedProps.custom?.parallelogram?.slant !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('parallelogram', props => (props.slant = value), uow);
        }
      }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const slant = node.renderProps.custom.parallelogram.slant;
    const slantPct = slant / node.bounds.w;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(slantPct, 0))
      .lineTo(_p(1, 0))
      .lineTo(_p(1 - slantPct, 1))
      .lineTo(_p(0, 1))
      .lineTo(_p(slantPct, 0));
  }
}

class ParallelogramComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const slant = props.nodeProps.custom.parallelogram.slant;

    shapeBuilder.boundaryPath(
      new ParallelogramNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    shapeBuilder.text(this);

    shapeBuilder.controlPoint(
      _p(props.node.bounds.x + slant, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
          props.node.updateCustomProps('parallelogram', props => (props.slant = distance), uow);
        }
        return `Slant: ${props.node.renderProps.custom.parallelogram.slant}px`;
      }
    );
  }
}
