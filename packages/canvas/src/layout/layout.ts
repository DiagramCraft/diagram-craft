import { Box, WritableBox } from '@diagram-craft/geometry/box';

export type ContainerLayoutInstructions = {
  direction: 'vertical' | 'horizontal';
  gap?: number;
};

export type ElementLayoutInstructions = {
  width?: { min?: number; max?: number };
  height?: { min?: number; max?: number };
  preserveAspectRatio?: boolean;
  grow?: number;
  shrink?: number;
};

export interface LayoutNode {
  id: string;
  // Relative bounds to parent bounds
  bounds: WritableBox;
  children: LayoutNode[];

  containerInstructions: ContainerLayoutInstructions;
  elementInstructions: ElementLayoutInstructions;
}

// Constants for default constraint values
const DEFAULT_MIN = 0;
const DEFAULT_MAX = Infinity;
const DEFAULT_GAP = 0;

type Axis = 'horizontal' | 'vertical';

/**
 * Get constraints for a specific axis
 */
const getAxisConstraints = (
  node: LayoutNode,
  axis: Axis
): { min?: number; max?: number } | undefined => {
  return axis === 'horizontal' ? node.elementInstructions.width : node.elementInstructions.height;
};

/**
 * Generic function to calculate intrinsic size (min or max) based on children's constraints.
 *
 * Algorithm:
 * 1. Base case (leaf nodes):
 *    - Min: Returns 0 (no intrinsic minimum, explicit constraints handled separately)
 *    - Max: Returns Infinity (no intrinsic maximum)
 *
 * 2. Container with children in SAME direction as query axis:
 *    Example: Querying horizontal size of a horizontal container
 *    - For each child:
 *      a. Recursively calculate its intrinsic size
 *      b. Get its explicit constraint (min or max)
 *      c. Min: Take max(intrinsic, explicit) - child needs at least this much
 *      d. Max: Take min(intrinsic, explicit) - child can grow at most this much
 *    - Min: Sum all child sizes + gaps (total space needed)
 *    - Max: Sum all child sizes + gaps (total space available, or Infinity if any child unbounded)
 *
 * 3. Container with children PERPENDICULAR to query axis:
 *    Example: Querying horizontal size of a vertical container
 *    - For each child:
 *      a. Recursively calculate its intrinsic size
 *      b. Combine with explicit constraints as above
 *    - Min: Take max of all children (container must fit widest child)
 *    - Max: Take max of all children (container constrained by widest child, or Infinity if any unbounded)
 *
 * This ensures that containers respect their children's space requirements, preventing
 * shrinking below minimum needed or growing beyond maximum allowed by content.
 */
const getIntrinsicSize = (node: LayoutNode, axis: Axis, type: 'min' | 'max'): number => {
  if (node.children.length === 0) {
    return type === 'min' ? DEFAULT_MIN : DEFAULT_MAX;
  }

  const direction = node.containerInstructions.direction;
  const gap = node.containerInstructions.gap ?? DEFAULT_GAP;
  const totalGaps = gap * Math.max(0, node.children.length - 1);

  if (direction === axis) {
    // Children are laid out along the same axis - sum their sizes
    let total = 0;
    for (const child of node.children) {
      const intrinsic = getIntrinsicSize(child, axis, type);
      const constraints = getAxisConstraints(child, axis);
      const explicit =
        type === 'min' ? (constraints?.min ?? DEFAULT_MIN) : (constraints?.max ?? DEFAULT_MAX);
      const childSize =
        type === 'min' ? Math.max(intrinsic, explicit) : Math.min(intrinsic, explicit);

      if (type === 'max' && childSize === Infinity) {
        return Infinity;
      }
      total += childSize;
    }
    return total + totalGaps;
  } else {
    // Children are laid out perpendicular - take the max of their sizes
    let result = 0;
    for (const child of node.children) {
      const intrinsic = getIntrinsicSize(child, axis, type);
      const constraints = getAxisConstraints(child, axis);
      const explicit =
        type === 'min' ? (constraints?.min ?? DEFAULT_MIN) : (constraints?.max ?? DEFAULT_MAX);
      const childSize =
        type === 'min' ? Math.max(intrinsic, explicit) : Math.min(intrinsic, explicit);

      if (type === 'max' && childSize === Infinity) {
        return Infinity;
      }
      result = Math.max(result, childSize);
    }
    return result;
  }
};

/**
 * Information about a child node used during layout calculation
 */
type ChildInfo = {
  /** The child node being laid out */
  child: LayoutNode;

  /** Axis-aligned bounding box accounting for rotation */
  boundingBox: Box;

  /** Initial size in the main axis (from bounding box) */
  originalSize: number;

  /** Calculated size in the main axis after grow/shrink */
  finalSize: number;

  /** Calculated size in the cross axis (for aspect ratio preservation) */
  crossAxisSize: number | undefined;

  /** Flex-grow factor (how much this child should grow relative to siblings) */
  grow: number;

  /** Flex-shrink factor (how much this child should shrink relative to siblings) */
  shrink: number;

  /** Effective minimum size (max of intrinsic and explicit constraints) */
  min: number;

  /** Effective maximum size (min of intrinsic and explicit constraints) */
  max: number;
};

/**
 * Apply grow distribution to children
 */
const applyGrow = (childInfo: ChildInfo[], freeSpace: number): void => {
  const totalGrow = childInfo.reduce((sum, info) => sum + info.grow, 0);

  for (const info of childInfo) {
    if (info.grow > 0) {
      const extraSpace = (freeSpace * info.grow) / totalGrow;
      info.finalSize = Math.min(info.max, info.originalSize + extraSpace);
    }
  }
};

/**
 * Apply shrink distribution to children
 */
const applyShrink = (childInfo: ChildInfo[], freeSpace: number): void => {
  const totalShrinkFactor = childInfo.reduce(
    (sum, info) => sum + info.shrink * info.originalSize,
    0
  );

  for (const info of childInfo) {
    if (info.shrink > 0 && totalShrinkFactor > 0) {
      const shrinkAmount = (-freeSpace * info.shrink * info.originalSize) / totalShrinkFactor;
      info.finalSize = Math.max(info.min, info.originalSize - shrinkAmount);
    }
  }
};

/**
 * Apply aspect ratio preservation for resized children
 */
const applyAspectRatio = (childInfo: ChildInfo[], isHorizontal: boolean): void => {
  for (const info of childInfo) {
    if (
      info.child.elementInstructions.preserveAspectRatio &&
      info.finalSize !== info.originalSize
    ) {
      const aspectRatio = info.child.bounds.w / info.child.bounds.h;
      const crossConstraints = getAxisConstraints(
        info.child,
        isHorizontal ? 'vertical' : 'horizontal'
      );

      const newCrossSize = isHorizontal
        ? info.finalSize / aspectRatio
        : info.finalSize * aspectRatio;

      info.crossAxisSize = Math.max(
        crossConstraints?.min ?? DEFAULT_MIN,
        Math.min(crossConstraints?.max ?? DEFAULT_MAX, newCrossSize)
      );
    }
  }
};

/**
 * Main layout function implementing a simplified flexbox algorithm.
 *
 * Algorithm overview:
 * 1. Collect child information including intrinsic min/max sizes from nested children
 * 2. Calculate available space and determine if we need to grow or shrink
 * 3. Distribute space according to flex-grow or flex-shrink factors
 * 4. Apply aspect ratio preservation if requested
 * 5. Position and size children, then recursively layout their children
 */
export const layoutChildren = (layoutNode: LayoutNode) => {
  if (layoutNode.children.length === 0) return;

  const axis = layoutNode.containerInstructions.direction;
  const gap = layoutNode.containerInstructions.gap ?? DEFAULT_GAP;
  const isHorizontal = axis === 'horizontal';
  const containerSize = isHorizontal ? layoutNode.bounds.w : layoutNode.bounds.h;

  // Collect child information with effective min/max constraints
  const childInfo: ChildInfo[] = layoutNode.children.map(child => {
    const boundingBox = Box.boundingBox([WritableBox.asBox(child.bounds)], true);
    const originalSize = isHorizontal ? boundingBox.w : boundingBox.h;
    const constraints = getAxisConstraints(child, axis);

    const intrinsicMin = getIntrinsicSize(child, axis, 'min');
    const intrinsicMax = getIntrinsicSize(child, axis, 'max');
    const effectiveMin = Math.max(intrinsicMin, constraints?.min ?? DEFAULT_MIN);
    const effectiveMax = Math.min(intrinsicMax, constraints?.max ?? DEFAULT_MAX);

    return {
      child,
      boundingBox,
      originalSize,
      finalSize: originalSize,
      crossAxisSize: undefined,
      grow: child.elementInstructions.grow ?? 0,
      shrink: child.elementInstructions.shrink ?? 0,
      min: effectiveMin,
      max: effectiveMax
    };
  });

  // Calculate available space and determine grow/shrink
  const totalGaps = gap * Math.max(0, layoutNode.children.length - 1);
  const totalOriginalSize = childInfo.reduce((sum, info) => sum + info.originalSize, 0);
  const freeSpace = containerSize - totalGaps - totalOriginalSize;

  const shouldGrow = freeSpace > 0 && childInfo.some(info => info.grow > 0);
  const shouldShrink = freeSpace < 0 && childInfo.some(info => info.shrink > 0);

  // Apply flex-grow or flex-shrink
  if (shouldGrow) {
    applyGrow(childInfo, freeSpace);
  } else if (shouldShrink) {
    applyShrink(childInfo, freeSpace);
  }

  // Apply aspect ratio preservation if any child was resized
  if (shouldGrow || shouldShrink) {
    applyAspectRatio(childInfo, isHorizontal);
  }

  // Position and size children
  let currentOffset = 0;
  for (const info of childInfo) {
    const { child, finalSize, crossAxisSize } = info;

    // Set position in layout direction
    if (isHorizontal) {
      child.bounds.x = currentOffset;
      if (shouldGrow || shouldShrink) {
        child.bounds.w = finalSize;
        if (crossAxisSize !== undefined) child.bounds.h = crossAxisSize;
      }
    } else {
      child.bounds.y = currentOffset;
      if (shouldGrow || shouldShrink) {
        child.bounds.h = finalSize;
        if (crossAxisSize !== undefined) child.bounds.w = crossAxisSize;
      }
    }

    currentOffset += finalSize + gap;
    layoutChildren(child); // Recursively layout children
  }
};

// Export internal functions for testing
export const _test = {
  getAxisConstraints,
  getIntrinsicSize,
  applyGrow,
  applyShrink,
  applyAspectRatio
};
