import type { DiagramNode } from './diagramNode';
import { isNode, type DiagramElement } from './diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import type { UnitOfWork } from './unitOfWork';
import { EffectsRegistry } from './effect';

/**
 * Finds the first collapsed ancestor container of a node.
 * Walks up the parent chain to find the nearest collapsed container.
 *
 * @param node The node to check
 * @returns The collapsed ancestor node, or null if none exists
 */
export const getCollapsedAncestor = (node: DiagramNode): DiagramNode | null => {
  let current = node.parent;
  while (current && isNode(current)) {
    const customProps = current.renderProps.custom['_collapsible'];
    if (customProps?.mode === 'collapsed') {
      return current;
    }
    current = current.parent;
  }
  return null;
};

/**
 * Gets the expanded (original) bounds of a container if it's collapsed,
 * otherwise returns the current bounds.
 * For collapsed containers, uses width and height from stored bounds,
 * but x, y, and rotation from current bounds.
 *
 * @param node The node to get expanded bounds for
 * @returns The expanded bounds if collapsed, otherwise current bounds
 */
export const getExpandedBounds = (node: DiagramNode): Box => {
  const def = node.getDefinition();
  if (def.supports?.('collapsible')) {
    const customProps = node.renderProps.custom['_collapsible'];
    if (customProps?.mode === 'collapsed' && customProps?.bounds) {
      const storedBounds = Box.fromString(customProps.bounds);
      return {
        x: node.bounds.x,
        y: node.bounds.y,
        w: storedBounds.w,
        h: storedBounds.h,
        r: node.bounds.r
      };
    }
  }
  return node.bounds;
};

/**
 * Calculates proportional bounds for a node that is hidden inside a collapsed container.
 * Returns where the node would be positioned relative to the collapsed container,
 * scaled proportionally based on where it was in the expanded container.
 *
 * @param node The node to calculate bounds for
 * @returns The proportional bounds if node has collapsed ancestor, otherwise current bounds
 */
export const getBoundsRelativeToCollapsedAncestor = (node: DiagramNode): Box => {
  const collapsedAncestor = getCollapsedAncestor(node);
  if (!collapsedAncestor) {
    return node.bounds;
  }

  const expandedContainer = getExpandedBounds(collapsedAncestor);
  const collapsedContainer = collapsedAncestor.bounds;

  const relativeX = (node.bounds.x - expandedContainer.x) / expandedContainer.w;
  const relativeY = (node.bounds.y - expandedContainer.y) / expandedContainer.h;
  const relativeW = node.bounds.w / expandedContainer.w;
  const relativeH = node.bounds.h / expandedContainer.h;

  return {
    x: collapsedContainer.x + relativeX * collapsedContainer.w,
    y: collapsedContainer.y + relativeY * collapsedContainer.h,
    w: relativeW * collapsedContainer.w,
    h: relativeH * collapsedContainer.h,
    r: node.bounds.r
  };
};

/**
 * Calculates the position of a point in normalized [0,1] coordinates within given bounds,
 * accounting for flip transformations, routing spacing, and effects.
 *
 * @param node The node to use for properties (flip, routing, effects)
 * @param p The point in normalized [0,1] coordinates
 * @param bounds The bounds to position within
 * @param respectRotation Whether to apply rotation transformation
 * @returns The absolute position of the point
 */
export const getPositionInBoundsForBox = (
  node: DiagramNode,
  p: Point,
  bounds: Box,
  respectRotation = true
): Point => {
  // Apply routing spacing if present
  let adjustedBounds = bounds;
  if (node.renderProps.routing.spacing > 0) {
    adjustedBounds = Box.grow(bounds, node.renderProps.routing.spacing);
  }

  const point = {
    x: adjustedBounds.x + adjustedBounds.w * (node.renderProps.geometry.flipH ? 1 - p.x : p.x),
    y: adjustedBounds.y + adjustedBounds.h * (node.renderProps.geometry.flipV ? 1 - p.y : p.y)
  };

  // Apply effects transformations
  let adjustedPoint = point;
  for (const e of EffectsRegistry.all()) {
    if (e.isUsedForNode(node.renderProps) && e.transformPoint) {
      adjustedPoint = e.transformPoint(bounds, node.renderProps, point);
    }
  }

  return respectRotation
    ? Point.rotateAround(adjustedPoint, adjustedBounds.r, Box.center(adjustedBounds))
    : adjustedPoint;
};

/**
 * Gets the absolute position of an anchor on a node for given bounds.
 *
 * @param node The node containing the anchor
 * @param anchorId The anchor ID to get position for
 * @param bounds The bounds to use for calculation
 * @returns The absolute position of the anchor
 */
export const getAnchorPositionForBounds = (
  node: DiagramNode,
  anchorId: string,
  bounds: Box
): Point => {
  return getPositionInBoundsForBox(node, node.getAnchor(anchorId).start, bounds);
};

/**
 * Gets all descendants (children, grandchildren, etc.) of a node recursively.
 *
 * @param node The node to get descendants for
 * @returns Array of all descendant elements
 */
export const getAllDescendants = (node: DiagramNode): DiagramElement[] => {
  const descendants: DiagramElement[] = [];

  const traverse = (current: DiagramNode) => {
    for (const child of current.children) {
      descendants.push(child);
      if (isNode(child)) {
        traverse(child);
      }
    }
  };

  traverse(node);
  return descendants;
};

/**
 * Invalidates all edges connected to descendants of a node.
 * This should be called when a container is collapsed or expanded to ensure
 * edges recalculate their endpoint positions.
 *
 * @param node The container node whose descendant edges should be invalidated
 * @param uow The unit of work to track changes
 */
export const invalidateDescendantEdges = (node: DiagramNode, uow: UnitOfWork): void => {
  const descendants = getAllDescendants(node);

  for (const descendant of descendants) {
    if (isNode(descendant)) {
      for (const edge of descendant.edges) {
        edge.invalidate(uow);
      }
    }
  }
};
