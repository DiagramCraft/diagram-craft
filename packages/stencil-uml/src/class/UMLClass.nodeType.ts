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
import { Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import { Box } from '@diagram-craft/geometry/box';
import { NodeShapeConstructor } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { applyLayoutTree, buildLayoutTree } from '@diagram-craft/canvas/layout/layoutTree';
import { layoutChildren } from '@diagram-craft/canvas/layout/layout';
import {
  classifyPortChildren,
  isUMLPortNode,
  preparePortLayoutTree,
  snapPortsInLayoutTree
} from '@diagram-craft/stencil-uml/common/umlPortLayout';
import {
  getStereotypeIconTextProps,
  renderStereotypeIcon,
  UML_STEREOTYPE_ICON_OPTIONS,
  UmlStereotypeIcon
} from '@diagram-craft/stencil-uml/common/stereotypeIcon';

const DEFAULT_TITLE_SIZE = 20;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlClass?: {
        size?: number;
        stereotypeIcon?: UmlStereotypeIcon;
      };
    }
  }
}

registerCustomNodeDefaults('umlClass', {
  size: DEFAULT_TITLE_SIZE,
  stereotypeIcon: 'empty'
});

export class UMLClassNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;
  additionalFillCount = 1;

  constructor(
    type = 'umlClass',
    name = 'UML Class',
    // biome-ignore lint/suspicious/noExplicitAny: allows subclassing with a different component
    component: NodeShapeConstructor<any> = UMLClassComponent
  ) {
    super(type, name, component);

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
    return new CustomPropertyDefinition(p => [
      p.select(
        def,
        'Stereotype Icon',
        'custom.umlClass.stereotypeIcon',
        UML_STEREOTYPE_ICON_OPTIONS
      ),
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

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    this.applyLayoutToChildrenRecursively(node, uow);

    if (this.getCollapsibleProps(node).mode === 'collapsed') {
      return;
    }

    let layoutRoot = node;
    while (
      layoutRoot.parent &&
      isNode(layoutRoot.parent) &&
      layoutRoot.parent.getDefinition().hasFlag(NodeFlags.ChildrenCanHaveLayout)
    ) {
      layoutRoot = layoutRoot.parent;
    }

    uow.on('before', 'commit', `layout/${layoutRoot.id}`, () => {
      const layoutTree = buildLayoutTree(layoutRoot);
      // UML ports participate in rendering and hit testing as children, but not in the
      // class compartment flow layout. They are snapped to the host border afterwards.
      preparePortLayoutTree(layoutRoot, layoutTree);
      layoutChildren(layoutTree);
      snapPortsInLayoutTree(layoutRoot, layoutTree);
      applyLayoutTree(layoutRoot, layoutTree, uow);
    });
  }
}

export class UMLClassComponent extends BaseNodeComponent<UMLClassNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const titleSize = props.nodeProps.custom.umlClass.size ?? DEFAULT_TITLE_SIZE;
    const stereotypeIcon = props.nodeProps.custom.umlClass.stereotypeIcon ?? 'empty';

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
    const hasNonPortChildren = props.node.children.some(child => !isUMLPortNode(child));
    if (childrenVisible) {
      const { ports, regularChildren } = classifyPortChildren(props.node);
      const compartments = regularChildren.toSorted((a, b) => a.bounds.y - b.bounds.y);

      const children: VNode[] = [];

      if (compartments.length > 0) {
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
        for (let i = 0; i < compartments.length; i++) {
          const child = compartments[i]!;
          children.push(
            svg.g(
              { transform: Transforms.rotateBack(props.node.bounds) },
              renderElement(this, child, props)
            )
          );
          h += child.bounds.h;

          if (i < compartments.length - 1) {
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
      }

      for (const port of ports) {
        children.push(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, port, props)
          )
        );
      }

      builder.add(svg.g({}, ...children));
    }

    const icon = renderStereotypeIcon(
      { ...bounds, h: childrenVisible ? titleSize : bounds.h },
      stereotypeIcon,
      nodeProps,
      -0.5
    );
    if (icon) {
      builder.add(icon);
    }

    builder.text(
      this,
      '1',
      props.node.getText(),
      getStereotypeIconTextProps(nodeProps.text, stereotypeIcon),
      { ...bounds, h: childrenVisible && hasNonPortChildren ? titleSize : bounds.h },
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
