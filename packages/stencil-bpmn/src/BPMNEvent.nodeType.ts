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
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import mailFilledIcon from './icons/mail-filled.svg?raw';
import mailIcon from './icons/mail.svg?raw';
import zigzagIcon from './icons/zigzag.svg?raw';
import navigationIcon from './icons/navigation.svg?raw';
import navigationFilledIcon from './icons/navigation-filled.svg?raw';
import xIcon from './icons/x.svg?raw';
import xFilledIcon from './icons/x-filled.svg?raw';
import zigzagFilledIcon from './icons/zigzag-filled.svg?raw';
import clockHour3Icon from './icons/clock-hour-3.svg?raw';
import playerTrackPrevIcon from './icons/player-track-prev.svg?raw';
import playerTrackPrevFilledIcon from './icons/player-track-prev-filled.svg?raw';
import boxWithLinesIcon from './icons/box-with-lines.svg?raw';
import arrowBigRightIcon from './icons/arrow-big-right.svg?raw';
import arrowBigRightFilledIcon from './icons/arrow-big-right-filled.svg?raw';
import triangleIcon from './icons/triangle.svg?raw';
import triangleFilledIcon from './icons/triangle-filled.svg?raw';
import pentagonIcon from './icons/pentagon.svg?raw';
import pentagonFilledIcon from './icons/pentagon-filled.svg?raw';
import crossIcon from './icons/cross.svg?raw';
import { Anchor } from '@diagram-craft/model/anchor';
import { _p } from '@diagram-craft/geometry/point';

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

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnEvent?: {
        eventType?: EventType;
        nonInterrupting?: boolean;
        throwing?: boolean;
        marker?: MarkerType;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnEvent', {
  eventType: 'start',
  nonInterrupting: false,
  throwing: false,
  marker: 'none'
});

export class BPMNEventNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnEvent', 'BPMN Event', BPMNEventNodeDefinition.Shape);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: _p(0.5, 0), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { start: _p(1, 0.5), id: '2', type: 'point', isPrimary: true, normal: 0 },
      { start: _p(0.5, 1), id: '3', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0, 0.5), id: '4', type: 'point', isPrimary: true, normal: Math.PI },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }

  static Shape = class extends BaseNodeComponent<BPMNEventNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      const bounds = node.bounds;

      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;

      const eventProps = node.renderProps.custom.bpmnEvent;
      const eventType = eventProps.eventType ?? 'start';

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

      const shouldUseFilledIcon = eventType === 'end' || eventProps.throwing;
      if (eventProps.marker === 'message') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? mailFilledIcon : mailIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'timer') {
        this.renderIcon(getSVGIcon(clockHour3Icon), props.node, shapeBuilder);
      } else if (eventProps.marker === 'error') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? zigzagFilledIcon : zigzagIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'escalation') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? navigationFilledIcon : navigationIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'cancel') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? xFilledIcon : xIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'compensation') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? playerTrackPrevFilledIcon : playerTrackPrevIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'conditional') {
        this.renderIcon(getSVGIcon(boxWithLinesIcon), props.node, shapeBuilder);
      } else if (eventProps.marker === 'link') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? arrowBigRightFilledIcon : arrowBigRightIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'signal') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? triangleFilledIcon : triangleIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'terminate') {
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
      } else if (eventProps.marker === 'multiple') {
        this.renderIcon(
          getSVGIcon(shouldUseFilledIcon ? pentagonFilledIcon : pentagonIcon),
          props.node,
          shapeBuilder
        );
      } else if (eventProps.marker === 'parallel-multiple') {
        this.renderIcon(getSVGIcon(crossIcon), props.node, shapeBuilder);
      }

      shapeBuilder.text(this);
    }

    protected adjustStyle(
      el: DiagramNode,
      nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const eventProps = nodeProps.custom.bpmnEvent;
      const eventType = eventProps.eventType ?? 'start';

      if (eventType === 'end') {
        style.strokeWidth = '3';
      } else {
        style.strokeWidth = '1';
      }

      if (
        eventProps.nonInterrupting &&
        el.getPropsInfo('stroke.pattern')!.at(-1)!.type === 'default'
      ) {
        style.strokeDasharray = '3 3';
      }
    }

    private renderIcon(icon: Icon, node: DiagramNode, shapeBuilder: ShapeBuilder) {
      const nodeProps = node.renderProps;
      shapeBuilder.path(
        PathListBuilder.fromPathList(icon.pathList)
          .getPaths(TransformFactory.fromTo(icon.viewbox, Box.grow(node.bounds, -5)))
          .all(),
        undefined,
        {
          style: {
            fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
            stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none',
            strokeWidth: '1',
            strokeDasharray: 'none'
          }
        }
      );
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
      },
      {
        id: 'nonInterrupting',
        type: 'boolean',
        label: 'Non-Interrupting',
        value: def.renderProps.custom.bpmnEvent.nonInterrupting ?? false,
        isSet: def.storedProps.custom?.bpmnEvent?.nonInterrupting !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnEvent', props => (props.nonInterrupting = undefined), uow);
          } else {
            def.updateCustomProps('bpmnEvent', props => (props.nonInterrupting = value), uow);
          }
        }
      },
      {
        id: 'throwing',
        type: 'boolean',
        label: 'Throwing',
        value: def.renderProps.custom.bpmnEvent.throwing ?? false,
        isSet: def.storedProps.custom?.bpmnEvent?.throwing !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnEvent', props => (props.throwing = undefined), uow);
          } else {
            def.updateCustomProps('bpmnEvent', props => (props.throwing = value), uow);
          }
        }
      },
      {
        id: 'marker',
        type: 'select',
        label: 'Marker',
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
        ],
        value: def.renderProps.custom.bpmnEvent.marker ?? 'none',
        isSet: def.storedProps.custom?.bpmnEvent?.marker !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnEvent', props => (props.marker = undefined), uow);
          } else {
            def.updateCustomProps('bpmnEvent', props => (props.marker = value as MarkerType), uow);
          }
        }
      }
    ];
  }
}
