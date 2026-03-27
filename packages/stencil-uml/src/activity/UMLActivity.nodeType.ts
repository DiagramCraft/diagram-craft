import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { getStereotypeIconTextProps } from '@diagram-craft/stencil-uml/common/stereotypeIcon';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { renderForkIconInBounds } from '@diagram-craft/stencil-uml/activity/forkIcon';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlActivity?: {
        type?: UMLActivityType;
      };
    }
  }
}

registerCustomNodeDefaults('umlActivity', {
  type: 'activity'
});

type UMLActivityType =
  | 'activity'
  | 'call-behaviour-action'
  | 'call-activity-action'
  | 'send-signal-action'
  | 'accept-event-action'
  | 'wait-time-action';

const ACTIVITY_RADIUS = 18;
const ACTIVITY_ICON_SIZE = 14;
const ACTIVITY_ICON_PADDING = 11;
const ACTIVITY_ICON_TEXT_INSET = ACTIVITY_ICON_SIZE + ACTIVITY_ICON_PADDING * 2;
const UML_ACTIVITY_TYPE_OPTIONS: Array<{ value: UMLActivityType; label: string }> = [
  { value: 'activity', label: 'Activity' },
  { value: 'call-behaviour-action', label: 'Call behaviour action' },
  { value: 'call-activity-action', label: 'Call activity action' },
  { value: 'send-signal-action', label: 'Send signal action' },
  { value: 'accept-event-action', label: 'Accept event action' },
  { value: 'wait-time-action', label: 'Wait time action' }
];
const hasForkIcon = (type: UMLActivityType) => type === 'call-activity-action';
const isSendSignalAction = (type: UMLActivityType) => type === 'send-signal-action';
const isAcceptEventAction = (type: UMLActivityType) => type === 'accept-event-action';
const isWaitTimeAction = (type: UMLActivityType) => type === 'wait-time-action';
const getShapeInset = (node: DiagramNode) => node.bounds.h * 0.3;

const getIconBounds = (node: DiagramNode) => ({
  x: node.bounds.x + node.bounds.w - ACTIVITY_ICON_SIZE - ACTIVITY_ICON_PADDING,
  y: node.bounds.y + ACTIVITY_ICON_PADDING,
  w: ACTIVITY_ICON_SIZE,
  h: ACTIVITY_ICON_SIZE,
  r: 0
});

const getRoundedActivityPathBuilder = (node: DiagramNode) => {
  const radius = Math.min(ACTIVITY_RADIUS, node.bounds.w / 2, node.bounds.h / 2);
  const xr = radius / node.bounds.w;
  const yr = radius / node.bounds.h;

  return new PathListBuilder()
    .withTransform(fromUnitLCS(node.bounds))
    .moveTo(_p(xr, 0))
    .lineTo(_p(1 - xr, 0))
    .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
    .lineTo(_p(1, 1 - yr))
    .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
    .lineTo(_p(xr, 1))
    .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
    .lineTo(_p(0, yr))
    .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
};

const getSendSignalPathBuilder = (bounds: Box, inset: number) =>
  new PathListBuilder()
    .moveTo(_p(bounds.x, bounds.y))
    .lineTo(_p(bounds.x + bounds.w - inset, bounds.y))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + bounds.h / 2))
    .lineTo(_p(bounds.x + bounds.w - inset, bounds.y + bounds.h))
    .lineTo(_p(bounds.x, bounds.y + bounds.h))
    .close();

const getAcceptEventPathBuilder = (bounds: Box, inset: number) =>
  new PathListBuilder()
    .moveTo(_p(bounds.x, bounds.y))
    .lineTo(_p(bounds.x + bounds.w, bounds.y))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + bounds.h))
    .lineTo(_p(bounds.x, bounds.y + bounds.h))
    .lineTo(_p(bounds.x + inset, bounds.y + bounds.h / 2))
    .close();

const getWaitTimePathBuilder = (bounds: Box) => {
  const centerX = bounds.x + bounds.w / 2;

  return new PathListBuilder()
    .moveTo(_p(bounds.x, bounds.y))
    .lineTo(_p(bounds.x + bounds.w, bounds.y))
    .lineTo(_p(centerX, bounds.y + bounds.h / 2))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + bounds.h))
    .lineTo(_p(bounds.x, bounds.y + bounds.h))
    .lineTo(_p(centerX, bounds.y + bounds.h / 2))
    .close();
};

const getTextProps = (node: DiagramNode) => {
  const activityType = node.renderProps.custom.umlActivity.type ?? 'activity';
  const baseTextProps = getStereotypeIconTextProps(node.renderProps.text, 'empty');
  const baseLeft = baseTextProps?.left ?? 0;
  const baseRight = baseTextProps?.right ?? 0;

  const leftInset = hasForkIcon(activityType)
    ? ACTIVITY_ICON_TEXT_INSET
    : isAcceptEventAction(activityType)
      ? getShapeInset(node) + 4
      : isWaitTimeAction(activityType)
        ? node.bounds.w * 0.2
        : baseLeft;

  const rightInset = hasForkIcon(activityType)
    ? ACTIVITY_ICON_TEXT_INSET
    : isSendSignalAction(activityType) || isAcceptEventAction(activityType)
      ? getShapeInset(node) + 4
      : isWaitTimeAction(activityType)
        ? node.bounds.w * 0.2
        : baseRight;

  return {
    ...baseTextProps,
    left: Math.max(baseLeft, leftInset),
    right: Math.max(baseRight, rightInset)
  };
};

export class UMLActivityNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlActivity', 'UML Activity', UMLActivityComponent);

    this.setFlags({
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getShapeAnchors(def: DiagramNode): Anchor[] {
    const activityType = def.renderProps.custom.umlActivity.type ?? 'activity';
    const anchors: Anchor[] = [
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 }
    ];

    if (!isWaitTimeAction(activityType)) {
      anchors.push({ id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 });
    }

    if (isAcceptEventAction(activityType)) {
      const insetX = Math.min(getShapeInset(def), Math.max(1, def.bounds.w / 2)) / def.bounds.w;
      anchors.push({
        id: '4',
        start: _p(insetX, 0.5),
        type: 'point',
        isPrimary: true,
        normal: Math.PI
      });
    } else if (!isWaitTimeAction(activityType)) {
      anchors.push({ id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI });
    }

    anchors.push({ id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' });

    return anchors;
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.select(
        def,
        'Type',
        'custom.umlActivity.type',
        UML_ACTIVITY_TYPE_OPTIONS
      )
    ]);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const activityType = node.renderProps.custom.umlActivity.type ?? 'activity';
    if (isSendSignalAction(activityType) || isAcceptEventAction(activityType)) {
      const bounds = Box.withoutRotation(node.bounds);
      const inset = Math.min(getShapeInset(node), Math.max(1, bounds.w / 2));

      if (isSendSignalAction(activityType)) {
        return getSendSignalPathBuilder(bounds, inset);
      }

      return getAcceptEventPathBuilder(bounds, inset);
    }

    if (isWaitTimeAction(activityType)) {
      return getWaitTimePathBuilder(Box.withoutRotation(node.bounds));
    }

    return getRoundedActivityPathBuilder(node);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    node.diagram.moveElement(elements, uow, node.layer, {
      relation: 'on',
      element: node
    });
  }
}

class UMLActivityComponent extends BaseNodeComponent<UMLActivityNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

    const activityType = props.nodeProps.custom.umlActivity.type ?? 'activity';
    if (hasForkIcon(activityType)) {
      builder.add(renderForkIconInBounds(getIconBounds(props.node), props.nodeProps));
    }

    builder.text(this, '1', props.node.getText(), getTextProps(props.node), props.node.bounds);

    if (props.node.children.length > 0) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
