import { CollapsibleOverlayComponent } from '@diagram-craft/canvas/shape/collapsible';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { isNode } from '@diagram-craft/model/diagramElement';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import { Box } from '@diagram-craft/geometry/box';

const DEFAULT_TITLE_SIZE = 20;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlClass?: {
        size?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlClass', {
  size: DEFAULT_TITLE_SIZE
});

export class UMLClassNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;
  additionalFillCount = 1;

  constructor() {
    super('umlClass', 'UML Class', UMLClassComponent);

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

  getContainerPadding(node: DiagramNode) {
    const titleSize = node.renderProps.custom.umlClass.size ?? DEFAULT_TITLE_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(_p => [
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const titleSize = node.renderProps.custom.umlClass.size ?? DEFAULT_TITLE_SIZE;
    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + titleSize)
    );
  }
}

export class UMLClassComponent extends BaseNodeComponent<UMLClassNodeDefinition> {
  getPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1, 0))
      .lineTo(_p(1, 1))
      .lineTo(_p(0, 1))
      .lineTo(_p(0, 0));
  }

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const titleSize = props.nodeProps.custom.umlClass.size ?? DEFAULT_TITLE_SIZE;

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    const titleFill = props.nodeProps.additionalFills?.['0'];
    if (titleFill?.enabled) {
      const strokeWidth = props.nodeProps.stroke.enabled ? props.nodeProps.stroke.width : 0;
      const color = titleFill.color ?? 'transparent';
      builder.add(
        svg.rect({
          x: bounds.x + strokeWidth,
          y: bounds.y + strokeWidth,
          width: bounds.w - 2 * strokeWidth,
          height: titleSize - 2 * strokeWidth,
          fill: color,
          stroke: color,
          style: 'pointer-events: none'
        })
      );
    }

    const childrenVisible =
      props.node.children.length > 0 && this.def.shouldRenderChildren(props.node);
    if (childrenVisible) {
      builder.add(
        svg.line({
          x1: bounds.x,
          y1: bounds.y + titleSize,
          x2: bounds.x + bounds.w,
          y2: bounds.y + titleSize,
          stroke: props.nodeProps.stroke.color
        })
      );

      let h = 0;
      const children: VNode[] = [];
      const childrenInOrder = props.node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      for (let i = 0; i < childrenInOrder.length; i++) {
        const child = childrenInOrder[i]!;
        children.push(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
        h += child.bounds.h;

        if (i < childrenInOrder.length - 1) {
          children.push(
            svg.line({
              x1: bounds.x,
              y1: bounds.y + titleSize + h,
              x2: bounds.x + bounds.w,
              y2: bounds.y + titleSize + h,
              stroke: props.nodeProps.stroke.color
            })
          );
        }
      }
      builder.add(svg.g({}, ...children));
    }

    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { ...bounds, h: childrenVisible ? titleSize : bounds.h },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.updateCustomProps('umlClass', p => (p.size = size.h), uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );
  }
}
