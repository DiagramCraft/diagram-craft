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
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { isNode } from '@diagram-craft/model/diagramElement';

const DEFAULT_TITLE_SIZE = 20;
const SEPARATOR_DASH = 'calc(5 * var(--stroke-dash-zoom, 1)), calc(3 * var(--stroke-dash-zoom, 1))';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlCollaboration?: {
        size?: number;
        titleHeight?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlCollaboration', {
  size: DEFAULT_TITLE_SIZE,
  titleHeight: 0
});

const getTitleHeight = (node: DiagramNode) => {
  const titleHeight = node.renderProps.custom.umlCollaboration.titleHeight;
  if (typeof titleHeight === 'number' && titleHeight > 0) return titleHeight;

  const size = node.renderProps.custom.umlCollaboration.size;
  if (typeof size === 'number') return size;

  return DEFAULT_TITLE_SIZE;
};

export const getCollaborationSeparatorChord = (node: DiagramNode, titleSize: number) => {
  const bounds = Box.withoutRotation(node.bounds);
  const rx = bounds.w / 2;
  const ry = bounds.h / 2;
  const cy = bounds.y + ry;
  const separatorY = bounds.y + titleSize;

  if (rx <= 0 || ry <= 0) {
    return { x1: bounds.x, y: separatorY, x2: bounds.x + bounds.w };
  }

  const normalizedY = (separatorY - cy) / ry;
  const radicand = Math.max(0, 1 - normalizedY * normalizedY);
  const dx = rx * Math.sqrt(radicand);
  const cx = bounds.x + rx;

  return {
    x1: cx - dx,
    y: separatorY,
    x2: cx + dx
  };
};

export class UMLCollaborationNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('umlCollaboration', 'UML Collaboration', UMLCollaborationComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: true
    });
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(0.5, 0))
      .arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1);
  }

  getContainerPadding(node: DiagramNode) {
    const titleSize = getTitleHeight(node);
    return { top: titleSize, right: 0, bottom: 0, left: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.number(def, 'Title Height', 'custom.umlCollaboration.titleHeight', {
        minValue: 1,
        unit: 'px'
      }),
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const titleSize = getTitleHeight(node);
    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + titleSize)
    );
  }
}

export class UMLCollaborationComponent extends BaseNodeComponent<UMLCollaborationNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const node = props.node;
    const nodeProps = props.nodeProps;
    const bounds = node.bounds;
    const titleSize = getTitleHeight(node);

    const boundary = this.def.getBoundingPathBuilder(node).getPaths();
    builder.boundaryPath(boundary.all());

    if (titleSize > 0 && this.def.shouldRenderChildren(node)) {
      const chord = getCollaborationSeparatorChord(node, titleSize);
      builder.add(
        svg.line({
          x1: chord.x1,
          y1: chord.y,
          x2: chord.x2,
          y2: chord.y,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width,
          'stroke-dasharray': SEPARATOR_DASH
        })
      );
    }

    builder.text(this, '1', node.getText(), nodeProps.text, { ...bounds, h: titleSize }, (size: Extent) =>
      UnitOfWork.execute(node.diagram, uow => {
        uow.metadata.nonDirty = true;
        node.updateCustomProps('umlCollaboration', p => (p.size = size.h), uow);
        const parent = node.parent;
        if (isNode(parent)) {
          parent.getDefinition().onChildChanged(parent, uow);
        }
      })
    );

    if (this.def.shouldRenderChildren(node)) {
      builder.add(renderChildren(this, node, props));
    }
  }
}
