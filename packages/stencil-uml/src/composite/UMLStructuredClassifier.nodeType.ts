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
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import { NodeShapeConstructor } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  applyLayoutTree,
  buildLayoutTree,
  LayoutNode
} from '@diagram-craft/canvas/layout/layoutTree';
import { layoutChildren } from '@diagram-craft/canvas/layout/layout';
import { mustExist } from '@diagram-craft/utils/assert';
import { Scale, Transform } from '@diagram-craft/geometry/transform';
import {
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
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';

const DEFAULT_TITLE_SIZE = 20;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlStructuredClassifier?: {
        size?: number;
        stereotypeIcon?: UmlStereotypeIcon;
        icon?: string;
      };
    }
  }
}

registerCustomNodeDefaults('umlStructuredClassifier', {
  size: DEFAULT_TITLE_SIZE,
  stereotypeIcon: 'empty',
  icon: ''
});

const findChildLayout = (layoutNode: LayoutNode, childId: string) =>
  mustExist(layoutNode.children.find(c => c.id === childId));

const prepareStructuredClassifierLayoutTree = (node: DiagramNode, layoutNode: LayoutNode) => {
  if (node.nodeType === 'umlStructuredClassifier') {
    for (const child of node.children) {
      if (!isNode(child)) continue;

      const childLayout = findChildLayout(layoutNode, child.id);
      childLayout.elementInstructions = {
        ...childLayout.elementInstructions,
        isAbsolute: true
      };
    }
  }

  for (const child of node.children) {
    if (!isNode(child)) continue;

    prepareStructuredClassifierLayoutTree(child, findChildLayout(layoutNode, child.id));
  }
};

export class UMLStructuredClassifierNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;
  additionalFillCount = 1;

  constructor(
    type = 'umlStructuredClassifier',
    name = 'UML Structured Classifier',
    // biome-ignore lint/suspicious/noExplicitAny: allows subclassing with a different component
    component: NodeShapeConstructor<any> = UMLStructuredClassifierComponent
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
    const titleSize = node.renderProps.custom.umlStructuredClassifier.size ?? DEFAULT_TITLE_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.select(
        def,
        'Stereotype Icon',
        'custom.umlStructuredClassifier.stereotypeIcon',
        UML_STEREOTYPE_ICON_OPTIONS
      ),
      p.icon(def, 'Custom Icon', 'custom.umlStructuredClassifier.icon'),
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const titleSize = node.renderProps.custom.umlStructuredClassifier.size ?? DEFAULT_TITLE_SIZE;
    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + titleSize)
    );
  }

  protected transformChildren(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    uow: UnitOfWork
  ): void {
    const hasScale = transforms.some(t => t instanceof Scale);

    for (const child of node.children) {
      if (hasScale && isUMLPortNode(child)) continue;
      child.transform(transforms, uow, true);
    }
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
      prepareStructuredClassifierLayoutTree(layoutRoot, layoutTree);
      preparePortLayoutTree(layoutRoot, layoutTree);
      layoutChildren(layoutTree);
      snapPortsInLayoutTree(layoutRoot, layoutTree);
      applyLayoutTree(layoutRoot, layoutTree, uow);
    });
  }
}

export class UMLStructuredClassifierComponent extends BaseNodeComponent<UMLStructuredClassifierNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;
    const titleSize = nodeProps.custom.umlStructuredClassifier.size ?? DEFAULT_TITLE_SIZE;
    const stereotypeIcon = nodeProps.custom.umlStructuredClassifier.stereotypeIcon ?? 'empty';
    const customIcon = nodeProps.custom.umlStructuredClassifier.icon ?? '';

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    const titleFill = nodeProps.additionalFills?.['0'];
    if (titleFill?.enabled) {
      const strokeWidth = nodeProps.stroke.enabled ? nodeProps.stroke.width : 0;
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

    builder.add(
      svg.line({
        x1: bounds.x,
        y1: bounds.y + titleSize,
        x2: bounds.x + bounds.w,
        y2: bounds.y + titleSize,
        stroke: nodeProps.stroke.color
      })
    );

    if (props.node.children.length > 0 && this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }

    const icon = renderStereotypeIcon({ ...bounds, h: titleSize }, stereotypeIcon, nodeProps, 0, {
      customIcon,
      resolvedColor: resolveCssColor(nodeProps.stroke.color, [
        CanvasDomHelper.diagramElement(props.node.diagram),
        document.body
      ])
    });
    if (icon) {
      builder.add(icon);
    }

    builder.text(
      this,
      '1',
      props.node.getText(),
      getStereotypeIconTextProps(nodeProps.text, stereotypeIcon),
      { ...bounds, h: titleSize },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;
          props.node.updateCustomProps('umlStructuredClassifier', p => (p.size = size.h), uow);
          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );
  }
}
