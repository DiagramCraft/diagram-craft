import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import {
  getIcon,
  Icon,
  RECTANGULAR_SHAPE_ANCHORS,
  renderIcon
} from '@diagram-craft/stencil-bpmn/utils';
import { Box } from '@diagram-craft/geometry/box';
import {
  arrowBigRightFilledIcon,
  arrowBigRightIcon,
  boxWithLinesIcon,
  clockHour3Icon,
  crossIcon,
  mailFilledIcon,
  mailIcon,
  navigationFilledIcon,
  navigationIcon,
  pentagonFilledIcon,
  pentagonIcon,
  playerTrackPrevFilledIcon,
  playerTrackPrevIcon,
  triangleFilledIcon,
  triangleIcon,
  xFilledIcon,
  xIcon,
  zigzagFilledIcon,
  zigzagIcon
} from './icons/icons';
import { Anchor } from '@diagram-craft/model/anchor';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';

type EventType = 'start' | 'intermediate' | 'end';
type MarkerType =
  | 'none'
  | 'message'
  | 'timer'
  | 'error'
  | 'escalation'
  | 'cancel'
  | 'compensation'
  | 'conditional'
  | 'link'
  | 'signal'
  | 'terminate'
  | 'multiple'
  | 'parallel-multiple';

type Data = {
  eventType?: EventType;
  nonInterrupting?: boolean;
  throwing?: boolean;
  marker?: MarkerType;
};

const SCHEMA: DataSchema = {
  id: 'bpmnEvent',
  name: 'BPMN Event',
  providerId: 'default',
  fields: [
    {
      id: 'name',
      name: 'Name',
      type: 'text'
    },
    {
      id: 'eventType',
      name: 'Event Type',
      type: 'select',
      options: [
        { value: 'start', label: 'Start' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'end', label: 'End' }
      ]
    },
    {
      id: 'nonInterrupting',
      name: 'Non-Interrupting',
      type: 'boolean'
    },
    {
      id: 'throwing',
      name: 'Throwing',
      type: 'boolean'
    },
    {
      id: 'marker',
      name: 'Marker',
      type: 'select',
      options: [
        { value: 'none', label: 'None' },
        { value: 'message', label: 'Message' },
        { value: 'timer', label: 'Timer' },
        { value: 'error', label: 'Error' },
        { value: 'escalation', label: 'Escalation' },
        { value: 'cancel', label: 'Cancel' },
        { value: 'compensation', label: 'Compensation' },
        { value: 'conditional', label: 'Conditional' },
        { value: 'link', label: 'Link' },
        { value: 'signal', label: 'Signal' },
        { value: 'terminate', label: 'Terminate' },
        { value: 'multiple', label: 'Multiple' },
        { value: 'parallel-multiple', label: 'Parallel Multiple' }
      ]
    }
  ]
};

export class BPMNEventNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnEvent', 'BPMN Event', BPMNEventNodeDefinition.Shape);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return RECTANGULAR_SHAPE_ANCHORS;
  }

  static Shape = class extends BaseNodeComponent<BPMNEventNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnEvent');
      return { type: 'default', ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      const bounds = node.bounds;

      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;

      const data = this.getData(node);
      const eventType = data.eventType ?? 'start';

      shapeBuilder.boundaryPath(
        new BPMNEventNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      if (eventType === 'intermediate') {
        const innerRadius = 0.85;
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

      const shouldUseFilledIcon = eventType === 'end' || data.throwing;
      if (data.marker === 'message') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? mailFilledIcon : mailIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'timer') {
        this.renderIcon(getIcon(clockHour3Icon), props.node, shapeBuilder);
      } else if (data.marker === 'error') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? zigzagFilledIcon : zigzagIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'escalation') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? navigationFilledIcon : navigationIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'cancel') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? xFilledIcon : xIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'compensation') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? playerTrackPrevFilledIcon : playerTrackPrevIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'conditional') {
        this.renderIcon(getIcon(boxWithLinesIcon), props.node, shapeBuilder);
      } else if (data.marker === 'link') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? arrowBigRightFilledIcon : arrowBigRightIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'signal') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? triangleFilledIcon : triangleIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'terminate') {
        const innerRadius = 0.7;
        const rx = (bounds.w / 2) * innerRadius;
        const ry = (bounds.h / 2) * innerRadius;

        const innerCircle = new PathListBuilder()
          .moveTo({ x: cx + rx, y: cy })
          .arcTo({ x: cx - rx, y: cy }, rx, ry, 0, 0, 0)
          .arcTo({ x: cx + rx, y: cy }, rx, ry, 0, 0, 0)
          .close();

        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: props.nodeProps.stroke.color }
        });
      } else if (data.marker === 'multiple') {
        this.renderIcon(
          getIcon(shouldUseFilledIcon ? pentagonFilledIcon : pentagonIcon),
          props.node,
          shapeBuilder
        );
      } else if (data.marker === 'parallel-multiple') {
        this.renderIcon(getIcon(crossIcon), props.node, shapeBuilder);
      }

      shapeBuilder.text(this);
    }

    protected adjustStyle(
      node: DiagramNode,
      _nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const data = this.getData(node);
      const eventType = data.eventType ?? 'start';

      if (eventType === 'end') {
        style.strokeWidth = '3';
      } else {
        style.strokeWidth = '1';
      }

      if (data.nonInterrupting && node.getPropsInfo('stroke.pattern')!.at(-1)!.type === 'default') {
        style.strokeDasharray = '3 3';
      }
    }

    private renderIcon(icon: Icon, node: DiagramNode, shapeBuilder: ShapeBuilder) {
      return renderIcon(icon, Box.grow(node.bounds, -5), node.renderProps, shapeBuilder);
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

  getCustomPropertyDefinitions(_node: DiagramNode) {
    const def = new CustomPropertyDefinition(() => []);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
