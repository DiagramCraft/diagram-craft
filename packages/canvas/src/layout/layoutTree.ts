import { Box, WritableBox } from '@diagram-craft/geometry/box';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { LayoutCapableShapeNodeDefinitionInterface } from '../shape/layoutCapableShapeNodeDefinition';
import type { NodeDefinition } from '@diagram-craft/model/nodeDefinition';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { deepClone } from '@diagram-craft/utils/object';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Point } from '@diagram-craft/geometry/point';
import type {
  ContainerLayoutInstructions,
  ElementLayoutInstructions
} from '@diagram-craft/model/nodeDefinitionLayoutCapable';

/**
 * A node in the layout tree representing a diagram element with layout instructions.
 * The layout tree is built from diagram nodes and uses relative bounds for layout calculation.
 * After layout, the tree is applied back to update the absolute bounds of diagram nodes.
 */
export interface LayoutNode {
  /** Unique identifier matching the corresponding DiagramNode */
  id: string;

  /** Bounds relative to parent's bounds (used during layout calculation) */
  bounds: WritableBox;

  /** Child nodes that participate in this node's layout */
  children: LayoutNode[];

  layoutHasBeenApplied?: boolean;

  /** Layout instructions when this node acts as a container (undefined if no container instructions) */
  containerInstructions: ContainerLayoutInstructions | undefined;

  /** Layout instructions when this node is an element in a parent container (undefined if no element instructions) */
  elementInstructions: ElementLayoutInstructions | undefined;
}

const isLayoutCapableShapeNodeDefinitionInterface = (
  def: NodeDefinition
): def is LayoutCapableShapeNodeDefinitionInterface => 'getContainerPadding' in def;

type ParentBounds = Box;
const buildLayoutTreeRecursive = (node: DiagramNode, parentBounds?: ParentBounds): LayoutNode => {
  const layoutProps = node.renderProps.layout;

  const containerInstructions: NonNullable<NodeProps['layout']>['container'] = deepClone(
    layoutProps?.container ?? {}
  );
  const elementInstructions = layoutProps?.element;

  const def = node.getDefinition();
  if (isLayoutCapableShapeNodeDefinitionInterface(def)) {
    const extraPadding = def.getContainerPadding(node);

    const containerPadding = containerInstructions?.padding ?? {};
    containerPadding.left ??= 0;
    containerPadding.right ??= 0;
    containerPadding.top ??= 0;
    containerPadding.bottom ??= 0;

    containerInstructions.padding = {
      left: containerPadding.left + extraPadding.left,
      right: containerPadding.right + extraPadding.right,
      top: containerPadding.top + extraPadding.top,
      bottom: containerPadding.bottom + extraPadding.bottom
    };

    if (def.getLayoutableChildren(node).length === 0) {
      containerInstructions.enabled = false;
    }
  }

  // Calculate relative bounds
  let relativeBounds: Box;
  if (parentBounds) {
    const childCenter = Box.center(node.bounds);
    const parentCenter = Box.center(parentBounds);
    const localCenter = Point.subtract(
      Point.rotateAround(childCenter, -parentBounds.r, parentCenter),
      Point.of(parentBounds.x, parentBounds.y)
    );

    relativeBounds = {
      x: localCenter.x - node.bounds.w / 2,
      y: localCenter.y - node.bounds.h / 2,
      w: node.bounds.w,
      h: node.bounds.h,
      r: node.bounds.r - parentBounds.r
    };
  } else {
    relativeBounds = { ...node.bounds };
  }
  const bounds = Box.asReadWrite(relativeBounds);

  // Build children recursively (only for DiagramNode children)
  const children: LayoutNode[] = node.children
    .filter((child): child is DiagramNode => isNode(child))
    .map(child => buildLayoutTreeRecursive(child, node.bounds));

  return {
    id: node.id,
    bounds,
    children,
    containerInstructions,
    elementInstructions
  };
};

/**
 * Builds a layout tree from a diagram node hierarchy.
 * Converts absolute bounds to relative bounds for layout calculation.
 * Only includes DiagramNode children (excludes edges and other element types).
 *
 * @param node - The root diagram node to build the layout tree from
 * @returns A layout tree with relative bounds ready for layout calculation
 *
 * @example
 * ```ts
 * const layoutTree = buildLayoutTree(containerNode);
 * layoutChildren(layoutTree);
 * applyLayoutTree(containerNode, layoutTree, uow);
 * ```
 */
export const buildLayoutTree = (node: DiagramNode): LayoutNode => {
  return buildLayoutTreeRecursive(node);
};

const applyLayoutTreeRecursive = (
  node: DiagramElement,
  layout: LayoutNode,
  uow: UnitOfWork,
  parentBounds?: ParentBounds
) => {
  // Convert relative bounds to absolute bounds
  let absoluteBounds: Box;

  if (parentBounds && parentBounds.r !== 0) {
    // Child bounds are stored in the parent's local coordinate space, so when the
    // parent is rotated we must rotate the child's center back into world space.
    const rotatedPosition = Point.subtract(
      Point.rotateAround(
        Box.center(WritableBox.asBox(layout.bounds)),
        parentBounds.r,
        Point.of(parentBounds.w / 2, parentBounds.h / 2)
      ),
      Point.of(layout.bounds.w / 2, layout.bounds.h / 2)
    );

    absoluteBounds = {
      x: parentBounds.x + rotatedPosition.x,
      y: parentBounds.y + rotatedPosition.y,
      w: layout.bounds.w,
      h: layout.bounds.h,
      r: parentBounds.r + layout.bounds.r
    };
  } else if (parentBounds) {
    // This is supposed to handle the case when there are children, but there's
    // no active layout - in that case, rotation does not need recalculation

    // TODO: Handle this is a better way?
    absoluteBounds = {
      x: parentBounds.x + layout.bounds.x,
      y: parentBounds.y + layout.bounds.y,
      w: layout.bounds.w,
      h: layout.bounds.h,
      r: parentBounds.r + layout.bounds.r
    };
  } else {
    absoluteBounds = WritableBox.asBox(layout.bounds);
  }

  // Update the node's bounds with absolute coordinates
  node.setBounds(absoluteBounds, uow);

  // Apply layout recursively to children
  // Match children by ID since the order might have changed
  const childLayoutMap = new Map(layout.children.map(child => [child.id, child]));

  for (const child of node.children) {
    if (isNode(child)) {
      const childLayout = childLayoutMap.get(child.id);
      if (childLayout) {
        applyLayoutTreeRecursive(child as DiagramNode, childLayout, uow, absoluteBounds);
      }
    }
  }
};

/**
 * Applies a calculated layout tree back to the diagram node hierarchy.
 * Converts relative bounds back to absolute bounds and updates all nodes.
 * Matches children by ID to handle any reordering that occurred during layout.
 *
 * @param node - The root diagram node to update
 * @param layout - The layout tree with calculated bounds
 * @param uow - Unit of work for tracking changes
 *
 * @example
 * ```ts
 * const layoutTree = buildLayoutTree(containerNode);
 * layoutChildren(layoutTree);
 * applyLayoutTree(containerNode, layoutTree, uow);
 * ```
 */
export const applyLayoutTree = (node: DiagramNode, layout: LayoutNode, uow: UnitOfWork) => {
  applyLayoutTreeRecursive(node, layout, uow);
};

// Export for testing
export const _test = {
  buildLayoutTreeRecursive,
  applyLayoutTreeRecursive
};
