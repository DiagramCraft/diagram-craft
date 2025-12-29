import { Box, WritableBox } from '@diagram-craft/geometry/box';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { LayoutCapableShapeNodeDefinitionInterface } from '../shape/layoutCapableShapeNodeDefinition';
import type { NodeDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { deepClone } from '@diagram-craft/utils/object';

/**
 * Layout direction for arranging children in a container.
 * - `horizontal`: Children are laid out left to right
 * - `vertical`: Children are laid out top to bottom
 */
export type Axis = 'horizontal' | 'vertical';

/**
 * Alignment of children along the main axis (the direction of layout).
 * - `start`: Children are packed at the start of the container
 * - `end`: Children are packed at the end of the container
 * - `center`: Children are centered in the container
 * - `space-between`: Children are evenly distributed with first at start and last at end
 */
export type JustifyContent = 'start' | 'end' | 'center' | 'space-between';

/**
 * Alignment of children along the cross axis (perpendicular to layout direction).
 * - `start`: Children are aligned to the start of the cross axis
 * - `end`: Children are aligned to the end of the cross axis
 * - `center`: Children are centered on the cross axis
 * - `stretch`: Children are stretched to fill the container's cross axis (respects preserveAspectRatio)
 * - `preserve`: Children maintain their original position on the cross axis
 */
export type AlignItems = 'start' | 'end' | 'center' | 'stretch' | 'preserve';

/**
 * Layout instructions for a container that arranges its children.
 * Implements a simplified flexbox-like layout algorithm.
 */
export type ContainerLayoutInstructions = {
  /** Direction in which children are laid out */
  direction: Axis;
  /** Spacing between children in pixels */
  gap?: number;
  /** Alignment of children along the main axis */
  justifyContent?: JustifyContent;
  /** Alignment of children along the cross axis */
  alignItems?: AlignItems;
  /** Padding around the container's content area */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Whether layout is enabled for this container (default: true) */
  enabled?: boolean;
};

/**
 * Layout instructions for an individual element within a container.
 * Controls sizing, flexibility, and positioning behavior.
 */
export type ElementLayoutInstructions = {
  /** Width constraints for the element */
  width?: { min?: number; max?: number };
  /** Height constraints for the element */
  height?: { min?: number; max?: number };
  /** Whether to maintain aspect ratio when resizing (default: false) */
  preserveAspectRatio?: boolean;
  /** Flex-grow factor for distributing extra space (default: 0) */
  grow?: number;
  /** Flex-shrink factor for distributing space deficit (default: 0) */
  shrink?: number;
  /** Whether element is absolutely positioned and excluded from layout (default: false) */
  isAbsolute?: boolean;
};

declare global {
  namespace DiagramCraft {
    interface NodePropsExtensions {
      layout?: {
        container?: ContainerLayoutInstructions;
        element?: ElementLayoutInstructions;
      };
    }
  }
}

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

  /** Layout instructions when this node acts as a container (undefined if no container instructions) */
  containerInstructions: ContainerLayoutInstructions | undefined;

  /** Layout instructions when this node is an element in a parent container (undefined if no element instructions) */
  elementInstructions: ElementLayoutInstructions | undefined;
}

const isLayoutCapableShapeNodeDefinitionInterface = (
  def: NodeDefinition
): def is LayoutCapableShapeNodeDefinitionInterface => 'getContainerPadding' in def;

type ParentBounds = { x: number; y: number; r: number };
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
  }

  // Calculate relative bounds
  const bounds = parentBounds
    ? Box.asReadWrite({
        x: node.bounds.x - parentBounds.x,
        y: node.bounds.y - parentBounds.y,
        w: node.bounds.w,
        h: node.bounds.h,
        r: node.bounds.r - parentBounds.r
      })
    : Box.asReadWrite({ ...node.bounds });

  // Build children recursively (only for DiagramNode children)
  const children: LayoutNode[] = node.children
    .filter((child): child is DiagramNode => child.type === 'node')
    .map(child =>
      buildLayoutTreeRecursive(child, { x: node.bounds.x, y: node.bounds.y, r: node.bounds.r })
    );

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
  node: DiagramNode,
  layout: LayoutNode,
  uow: UnitOfWork,
  parentBounds?: ParentBounds
) => {
  // Convert relative bounds to absolute bounds
  const absoluteBounds = parentBounds
    ? Box.asReadWrite({
        x: parentBounds.x + layout.bounds.x,
        y: parentBounds.y + layout.bounds.y,
        w: layout.bounds.w,
        h: layout.bounds.h,
        r: parentBounds.r + layout.bounds.r
      })
    : layout.bounds;

  // Update the node's bounds with absolute coordinates
  node.setBounds(WritableBox.asBox(absoluteBounds), uow);

  // Apply layout recursively to children
  // Match children by ID since the order might have changed
  const childLayoutMap = new Map(layout.children.map(child => [child.id, child]));

  for (const child of node.children) {
    if (child.type === 'node') {
      const childLayout = childLayoutMap.get(child.id);
      if (childLayout) {
        applyLayoutTreeRecursive(child as DiagramNode, childLayout, uow, {
          x: absoluteBounds.x,
          y: absoluteBounds.y,
          r: absoluteBounds.r
        });
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
