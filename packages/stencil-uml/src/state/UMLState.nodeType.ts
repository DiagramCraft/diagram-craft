import { CollapsibleOverlayComponent } from '@diagram-craft/canvas/shape/collapsible';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Anchor } from '@diagram-craft/model/anchor';

const DEFAULT_TITLE_SIZE = 24;
const DEFAULT_INTERNAL_ACTIVITIES_SIZE = 24;
const DEFAULT_CORNER_RADIUS = 12;
const INTERNAL_ACTIVITIES_TEXT_ID = 'internalActivities';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlState?: {
        size?: number;
        internalActivitiesSize?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlState', {
  size: DEFAULT_TITLE_SIZE,
  internalActivitiesSize: DEFAULT_INTERNAL_ACTIVITIES_SIZE
});

const hasTitle = (node: DiagramNode) => !isEmptyString(node.getText());
const hasInternalActivities = (node: DiagramNode) =>
  !isEmptyString(node.getText(INTERNAL_ACTIVITIES_TEXT_ID));
const hasChildren = (node: DiagramNode) => node.children.length > 0;

export class UMLStateNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('umlState', 'UML State', UMLStateComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: true,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: true
    });
  }

  onAdd(
    node: DiagramNode,
    diagram: Parameters<LayoutCapableShapeNodeDefinition['onAdd']>[1],
    uow: UnitOfWork
  ) {
    super.onAdd(node, diagram, uow);

    if (node.storedProps.custom?._collapsible?.collapsible === undefined) {
      node.updateCustomProps(
        '_collapsible',
        props => {
          props.collapsible = true;
        },
        uow
      );
    }
  }

  getContainerPadding(node: DiagramNode) {
    const titleSize = node.renderProps.custom.umlState.size ?? DEFAULT_TITLE_SIZE;
    const internalActivitiesSize =
      node.renderProps.custom.umlState.internalActivitiesSize ?? DEFAULT_INTERNAL_ACTIVITIES_SIZE;

    return {
      top:
        (hasTitle(node) ? titleSize : 0) +
        (hasInternalActivities(node) ? internalActivitiesSize : 0),
      bottom: 0,
      left: 0,
      right: 0
    };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(() => [
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const titleSize = node.renderProps.custom.umlState.size ?? DEFAULT_TITLE_SIZE;
    const internalActivitiesSize =
      node.renderProps.custom.umlState.internalActivitiesSize ?? DEFAULT_INTERNAL_ACTIVITIES_SIZE;
    const collapsedHeight =
      (hasTitle(node) ? titleSize : 0) + (hasInternalActivities(node) ? internalActivitiesSize : 0);

    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + collapsedHeight)
    );
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const { x, y, w, h } = node.bounds;
    const radius = Math.min(DEFAULT_CORNER_RADIUS, w / 2, h / 2);

    return new PathListBuilder()
      .moveTo(Point.of(x + radius, y))
      .lineTo(Point.of(x + w - radius, y))
      .arcTo(Point.of(x + w, y + radius), radius, radius, 0, 0, 1)
      .lineTo(Point.of(x + w, y + h - radius))
      .arcTo(Point.of(x + w - radius, y + h), radius, radius, 0, 0, 1)
      .lineTo(Point.of(x + radius, y + h))
      .arcTo(Point.of(x, y + h - radius), radius, radius, 0, 0, 1)
      .lineTo(Point.of(x, y + radius))
      .arcTo(Point.of(x + radius, y), radius, radius, 0, 0, 1)
      .close();
  }

  getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'n', start: Point.of(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: 'e', start: Point.of(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: 's', start: Point.of(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: 'w', start: Point.of(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
    ];
  }
}

export class UMLStateComponent extends BaseNodeComponent<UMLStateNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const { node, nodeProps } = props;
    const { bounds } = node;
    const titleSize = nodeProps.custom.umlState.size ?? DEFAULT_TITLE_SIZE;
    const internalActivitiesSize =
      nodeProps.custom.umlState.internalActivitiesSize ?? DEFAULT_INTERNAL_ACTIVITIES_SIZE;
    const shouldRenderChildren = this.def.shouldRenderChildren(node);
    const titlePresent = hasTitle(node);
    const internalActivitiesPresent = hasInternalActivities(node);
    const childrenPresent = shouldRenderChildren && hasChildren(node);
    let currentY = bounds.y;

    const boundary = this.def.getBoundingPathBuilder(node).getPaths();
    builder.boundaryPath(boundary.all());

    if (titlePresent) {
      const titleHasFollowingSection = internalActivitiesPresent || childrenPresent;

      builder.text(
        this,
        '1',
        node.getText(),
        nodeProps.text,
        { ...bounds, y: currentY, h: titleHasFollowingSection ? titleSize : bounds.h },
        (size: Extent) =>
          UnitOfWork.execute(node.diagram, uow => {
            uow.metadata.nonDirty = true;
            node.updateCustomProps('umlState', p => (p.size = size.h), uow);
            const parent = node.parent;
            if (isNode(parent)) {
              parent.getDefinition().onChildChanged(parent, uow);
            }
          })
      );

      currentY += titleSize;

      if (titleHasFollowingSection) {
        builder.add(
          svg.line({
            x1: bounds.x,
            y1: currentY,
            x2: bounds.x + bounds.w,
            y2: currentY,
            stroke: nodeProps.stroke.color
          })
        );
      }
    }

    if (internalActivitiesPresent) {
      const internalActivitiesHasFollowingSection = childrenPresent;
      const internalActivitiesBoundsHeight =
        internalActivitiesHasFollowingSection || titlePresent ? internalActivitiesSize : bounds.h;

      builder.text(
        this,
        INTERNAL_ACTIVITIES_TEXT_ID,
        node.getText(INTERNAL_ACTIVITIES_TEXT_ID),
        {
          ...nodeProps.text,
          align: 'left',
          bold: false
        },
        { ...bounds, y: currentY, h: internalActivitiesBoundsHeight },
        (size: Extent) =>
          UnitOfWork.execute(node.diagram, uow => {
            uow.metadata.nonDirty = true;
            node.updateCustomProps('umlState', p => (p.internalActivitiesSize = size.h), uow);
            const parent = node.parent;
            if (isNode(parent)) {
              parent.getDefinition().onChildChanged(parent, uow);
            }
          })
      );

      currentY += internalActivitiesSize;

      if (internalActivitiesHasFollowingSection) {
        builder.add(
          svg.line({
            x1: bounds.x,
            y1: currentY,
            x2: bounds.x + bounds.w,
            y2: currentY,
            stroke: nodeProps.stroke.color
          })
        );
      }
    }

    if (shouldRenderChildren) {
      const children = node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      const childNodes: VNode[] = [];
      let h = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        childNodes.push(
          svg.g(
            { transform: Transforms.rotateBack(node.bounds) },
            renderElement(this, child, props)
          )
        );
        h += child.bounds.h;

        if (i < children.length - 1) {
          childNodes.push(
            svg.line({
              'x1': bounds.x,
              'y1': currentY + h,
              'x2': bounds.x + bounds.w,
              'y2': currentY + h,
              'stroke': nodeProps.stroke.color,
              'stroke-dasharray':
                'calc(5 * var(--stroke-dash-zoom, 1)), calc(3 * var(--stroke-dash-zoom, 1))'
            })
          );
        }
      }

      builder.add(svg.g({}, ...childNodes));
    }
  }
}
