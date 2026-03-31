import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode, NodePropsForEditing } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren, renderElement } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { _p, Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { round } from '@diagram-craft/utils/math';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import {
  applyLayoutTree,
  buildLayoutTree,
  LayoutNode
} from '@diagram-craft/canvas/layout/layoutTree';
import { layoutChildren } from '@diagram-craft/canvas/layout/layout';
import { mustExist } from '@diagram-craft/utils/assert';
import {
  classifyPortChildren,
  isUMLPortNode,
  preparePortLayoutTree,
  snapPortsInLayoutTree
} from '@diagram-craft/stencil-uml/common/umlPortLayout';
import { Scale, Transform } from '@diagram-craft/geometry/transform';

const DEFAULT_LABEL_H = 20;
const DEFAULT_LABEL_W = 80;
const MAX_LABEL_W_FRACTION = 0.8;
const MIN_LABEL_W = 20;
const LABEL_CUT = 8;
const COMPARTMENT_LEFT_PADDING = 10;
const COMPARTMENT_SEPARATOR_DASH = '6,3';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlFrame?: {
        labelH?: number;
        labelW?: number;
        hasCompartments?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('umlFrame', {
  labelH: DEFAULT_LABEL_H,
  labelW: DEFAULT_LABEL_W,
  hasCompartments: false
});

const hasCompartments = (node: DiagramNode) =>
  node.renderProps.custom.umlFrame.hasCompartments ?? false;

const findChildLayout = (layoutNode: LayoutNode, childId: string) =>
  mustExist(layoutNode.children.find(c => c.id === childId));

const prepareFrameLayoutTree = (node: DiagramNode, layoutNode: LayoutNode) => {
  if (node.nodeType === 'umlFrame' && hasCompartments(node)) {
    layoutNode.containerInstructions = {
      ...layoutNode.containerInstructions,
      direction: 'vertical',
      enabled: true,
      alignItems: 'stretch',
      autoShrink: false,
      justifyContent: 'start',
      gap: 0
    };

    const { regularChildren } = classifyPortChildren(node);
    for (const child of regularChildren) {
      const childLayout = findChildLayout(layoutNode, child.id);
      childLayout.elementInstructions = {
        ...childLayout.elementInstructions,
        grow: child.bounds.h,
        shrink: 1
      };
    }
  }

  for (const child of node.children) {
    if (!isNode(child)) continue;
    prepareFrameLayoutTree(child, findChildLayout(layoutNode, child.id));
  }
};

export class UMLFrameNodeDefinition extends LayoutCapableShapeNodeDefinition {
  additionalFillCount = 1;

  constructor() {
    super('umlFrame', 'UML Frame', UMLFrameComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getContainerPadding(node: DiagramNode) {
    if (!hasCompartments(node)) return { top: 0, right: 0, bottom: 0, left: 0 };

    const labelW = node.renderProps.custom.umlFrame.labelW ?? DEFAULT_LABEL_W;
    return { top: 0, right: 0, bottom: 0, left: labelW + COMPARTMENT_LEFT_PADDING };
  }

  getLayoutableChildren(node: DiagramNode): ReadonlyArray<DiagramNode> {
    if (!hasCompartments(node)) {
      return node.children.filter(isNode);
    }

    return classifyPortChildren(node).regularChildren;
  }

  protected transformChildren(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    uow: UnitOfWork
  ): void {
    const hasScale = transforms.some(t => t instanceof Scale);

    for (const child of node.children) {
      if (hasCompartments(node) && hasScale && isUMLPortNode(child)) continue;
      child.transform(transforms, uow, true);
    }
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    if (!hasCompartments(node)) {
      this.applyLayoutToChildrenRecursively(node, uow);
      return;
    }

    this.applyLayoutToChildrenRecursively(node, uow);

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
      prepareFrameLayoutTree(layoutRoot, layoutTree);
      preparePortLayoutTree(layoutRoot, layoutTree);
      layoutChildren(layoutTree);
      snapPortsInLayoutTree(layoutRoot, layoutTree);
      applyLayoutTree(layoutRoot, layoutTree, uow);
    });
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Has Compartments', 'custom.umlFrame.hasCompartments')
    ]);
  }

  protected getCollapsedBounds(_storedBounds: string | undefined, node: DiagramNode): Box {
    const labelH = node.renderProps.custom.umlFrame.labelH ?? DEFAULT_LABEL_H;
    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + node.bounds.w, node.bounds.y + labelH)
    );
  }
}

export class UMLFrameComponent extends BaseNodeComponent<UMLFrameNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const labelH = props.nodeProps.custom.umlFrame.labelH ?? DEFAULT_LABEL_H;
    const labelW = props.nodeProps.custom.umlFrame.labelW ?? DEFAULT_LABEL_W;
    const maxLabelW = bounds.w * MAX_LABEL_W_FRACTION;
    const cut = LABEL_CUT;

    const isFillDisabled = nodeProps.fill.enabled === false;

    const labelFill = props.nodeProps.additionalFills?.['0'];
    if (labelFill?.enabled) {
      const color = labelFill.color ?? 'transparent';
      builder.add(
        svg.path({
          'd': [
            `M ${bounds.x} ${bounds.y}`,
            `L ${bounds.x + labelW} ${bounds.y}`,
            `L ${bounds.x + labelW} ${bounds.y + labelH - cut}`,
            `L ${bounds.x + labelW - cut} ${bounds.y + labelH}`,
            `L ${bounds.x} ${bounds.y + labelH}`,
            'Z'
          ].join(' '),
          'fill': color,
          'stroke': 'none',
          'stroke-width': 0,

          // We need to ensure the label is clickable in case the fill is disabled as we set
          // background to none in that case (to be able to easily select nodes behind)
          ...(isFillDisabled
            ? {
                on: {
                  mousedown: props.onMouseDown,
                  dblclick: builder.makeOnDblclickHandle('1')
                }
              }
            : {
                style: 'pointer-events: none'
              })
        })
      );
    }

    let boundaryProps: NodePropsForEditing = nodeProps;
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    if (isFillDisabled) {
      // We set to none to make it easier to select nodes behind the frame
      boundaryProps = { ...nodeProps, fill: { color: 'none' } };
    }
    builder.boundaryPath(boundary.all(), boundaryProps);

    // Label box inner border: right edge → diagonal cut → bottom edge
    // The top and left edges are shared with the outer rectangle border
    builder.add(
      svg.path({
        'd': [
          `M ${bounds.x + labelW} ${bounds.y}`,
          `L ${bounds.x + labelW} ${bounds.y + labelH - cut}`,
          `L ${bounds.x + labelW - cut} ${bounds.y + labelH}`,
          `L ${bounds.x} ${bounds.y + labelH}`
        ].join(' '),
        'fill': 'none',
        'stroke': nodeProps.stroke.color,
        'stroke-width': nodeProps.stroke.width
      })
    );

    // Label text inside the pentagon
    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { x: bounds.x, y: bounds.y, w: labelW, h: labelH, r: 0 },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;
          props.node.updateCustomProps('umlFrame', p => (p.labelH = size.h), uow);
        })
    );

    // Control point on the top edge to drag-adjust the label width
    builder.controlPoint(_p(bounds.x + labelW, bounds.y), (p, uow) => {
      const newLabelW = Math.max(MIN_LABEL_W, Math.min(p.x - bounds.x, maxLabelW));
      props.node.updateCustomProps('umlFrame', cp => (cp.labelW = newLabelW), uow);
      return `Label width: ${round(props.node.renderProps.custom.umlFrame.labelW ?? DEFAULT_LABEL_W)}px`;
    });

    const childrenVisible = this.def.shouldRenderChildren(props.node);
    if (childrenVisible && hasCompartments(props.node)) {
      const { ports, regularChildren } = classifyPortChildren(props.node);
      const compartments = regularChildren.toSorted((a, b) => a.bounds.y - b.bounds.y);
      const children: VNode[] = [];

      let separatorY = bounds.y;
      for (let i = 0; i < compartments.length; i++) {
        const child = compartments[i]!;
        children.push(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );

        separatorY += child.bounds.h;
        if (i < compartments.length - 1) {
          children.push(
            svg.line({
              'x1': bounds.x,
              'y1': separatorY,
              'x2': bounds.x + bounds.w,
              'y2': separatorY,
              'stroke': props.nodeProps.stroke.color,
              'stroke-width': props.nodeProps.stroke.width,
              'stroke-dasharray': COMPARTMENT_SEPARATOR_DASH
            })
          );
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
    } else if (childrenVisible) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
