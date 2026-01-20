import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

type EventType = 'start' | 'intermediate' | 'end';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnEvent?: {
        eventType?: EventType;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnEvent', {
  eventType: 'start'
});

export class BPMNEventNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnEvent', 'BPMN Event', BPMNEventNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNEventNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      const eventProps = node.renderProps.custom.bpmnEvent;
      const eventType = eventProps.eventType ?? 'start';

      shapeBuilder.boundaryPath(
        new BPMNEventNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      if (eventType === 'intermediate') {
        // Intermediate event: double circle (outer circle is the boundary, add inner circle)
        const innerRadius = 0.85; // Inner circle is 85% of the outer
        const bounds = node.bounds;
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        const rx = (bounds.w / 2) * innerRadius;
        const ry = (bounds.h / 2) * innerRadius;

        const innerCircle = new PathListBuilder()
          .moveTo({ x: cx + rx, y: cy })
          .arcTo({ x: cx - rx, y: cy }, rx, ry, 0, 0, 0)
          .arcTo({ x: cx + rx, y: cy }, rx, ry, 0, 0, 0)
          .close();

        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none' }
        });
      }
      shapeBuilder.text(this);
    }

    protected adjustStyle(
      _el: DiagramNode,
      nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const eventType = nodeProps.custom.bpmnEvent.eventType ?? 'start';

      if (eventType === 'end') {
        style.strokeWidth = '3';
      } else {
        style.strokeWidth = '1';
      }
    }
  };

  getBoundingPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const rx = bounds.w / 2;
    const ry = bounds.h / 2;

    return new PathListBuilder()
      .moveTo({ x: cx + rx, y: cy })
      .arcTo({ x: cx - rx, y: cy }, rx, ry, 0, 0, 0)
      .arcTo({ x: cx + rx, y: cy }, rx, ry, 0, 0, 0)
      .close();
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'eventType',
        type: 'select',
        label: 'Event Type',
        options: [
          { value: 'start', label: 'Start' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'end', label: 'End' }
        ],
        value: def.renderProps.custom.bpmnEvent.eventType ?? 'start',
        isSet: def.storedProps.custom?.bpmnEvent?.eventType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnEvent', props => (props.eventType = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnEvent',
              props => (props.eventType = value as EventType),
              uow
            );
          }
        }
      }
    ];
  }
}
