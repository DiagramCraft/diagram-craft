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
const TEMPLATE_BOX_W = 70;
const TEMPLATE_BOX_H = 24;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlClassTemplate?: {
        size?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlClassTemplate', {
  size: DEFAULT_TITLE_SIZE
});

export class UMLClassTemplateNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('umlClassTemplate', 'UML Class Template', UMLClassTemplateComponent);

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
    const titleSize = node.renderProps.custom.umlClassTemplate.size ?? DEFAULT_TITLE_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(_p => [
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const titleSize = node.renderProps.custom.umlClassTemplate.size ?? DEFAULT_TITLE_SIZE;
    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + titleSize)
    );
  }
}

export class UMLClassTemplateComponent extends BaseNodeComponent<UMLClassTemplateNodeDefinition> {
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

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all(), props.nodeProps, '1', {
      style: {
        fill: 'transparent',
        stroke: 'transparent'
      }
    });

    builder.path(this.getPathBuilder(props.node).getPaths().all(), nodeProps, {});

    const titleSize = props.nodeProps.custom.umlClassTemplate.size ?? DEFAULT_TITLE_SIZE;

    if (props.node.children.length > 0 && this.def.shouldRenderChildren(props.node)) {
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

    // Title text - same as UMLClass
    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { ...bounds, h: titleSize },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.updateCustomProps('umlClassTemplate', p => (p.size = size.h), uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );

    // Template binding box: dashed rectangle at top-right corner, overlapping the class border
    const templateX = bounds.x + bounds.w - TEMPLATE_BOX_W / 2;
    const templateY = bounds.y - TEMPLATE_BOX_H / 2;

    builder.add(
      svg.rect({
        'x': templateX,
        'y': templateY,
        'width': TEMPLATE_BOX_W,
        'height': TEMPLATE_BOX_H,
        'fill': nodeProps.fill.color,
        'stroke': nodeProps.stroke.color,
        'stroke-width': nodeProps.stroke.width,
        'stroke-dasharray':
          'calc(5 * var(--stroke-dash-zoom, 1)), calc(3 * var(--stroke-dash-zoom, 1))'
      })
    );

    // Template parameter text inside the dashed box
    builder.text(this, 'template', props.node.getText('template'), nodeProps.text, {
      x: templateX,
      y: templateY,
      w: TEMPLATE_BOX_W,
      h: TEMPLATE_BOX_H,
      r: 0
    });
  }
}
