import { Box, WritableBox } from '@diagram-craft/geometry/box';
import type {
  AlignItems,
  Axis,
  ContainerLayoutInstructions,
  JustifyContent,
  LayoutNode
} from './layoutTree';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

/**
 * Default values for layout properties
 */
const LAYOUT_DEFAULTS = {
  /** Default minimum size for elements */
  MIN: 0,

  /** Default maximum size for elements */
  MAX: Infinity,

  /** Default gap between children */
  GAP: 0,

  /** Default flex-grow factor */
  GROW: 0,

  /** Default flex-shrink factor */
  SHRINK: 0,

  /** Default layout enabled state */
  ENABLED: true
} as const;

type MinMax = { min?: number; max?: number };

/**
 * Get constraints for a specific axis
 */
const getAxisConstraints = (node: LayoutNode, axis: Axis): MinMax | undefined => {
  return axis === 'horizontal' ? node.elementInstructions?.width : node.elementInstructions?.height;
};

/**
 * Calculate padding for a specific axis
 * @returns Object containing start padding, end padding, and total padding for the axis
 */
const getAxisPadding = (padding: ContainerLayoutInstructions['padding'], axis: Axis) => {
  if (!padding) return { start: 0, end: 0, total: 0 };

  if (axis === 'horizontal') {
    const start = padding.left ?? 0;
    const end = padding.right ?? 0;
    return { start, end, total: start + end };
  } else {
    const start = padding.top ?? 0;
    const end = padding.bottom ?? 0;
    return { start, end, total: start + end };
  }
};

const getChildSize = (child: LayoutNode, axis: Axis, type: 'min' | 'max') => {
  const intrinsic = getIntrinsicSize(child, axis, type);
  const constraints = getAxisConstraints(child, axis);
  const explicit =
    type === 'min'
      ? (constraints?.min ?? LAYOUT_DEFAULTS.MIN)
      : (constraints?.max ?? LAYOUT_DEFAULTS.MAX);
  return type === 'min' ? Math.max(intrinsic, explicit) : Math.min(intrinsic, explicit);
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
 *    - Min: Sum all child sizes + gaps + padding (total space needed)
 *    - Max: Sum all child sizes + gaps + padding (total space available, or Infinity if any child unbounded)
 *
 * 3. Container with children PERPENDICULAR to query axis:
 *    Example: Querying horizontal size of a vertical container
 *    - For each child:
 *      a. Recursively calculate its intrinsic size
 *      b. Combine with explicit constraints as above
 *    - Min: Take max of all children + padding (container must fit widest child)
 *    - Max: Take max of all children + padding (container constrained by widest child, or Infinity if any unbounded)
 *
 * This ensures that containers respect their children's space requirements, preventing
 * shrinking below minimum needed or growing beyond maximum allowed by content.
 */
const getIntrinsicSize = (node: LayoutNode, axis: Axis, type: 'min' | 'max'): number => {
  if (node.children.length === 0 || !node.containerInstructions) {
    return type === 'min' ? LAYOUT_DEFAULTS.MIN : LAYOUT_DEFAULTS.MAX;
  }

  const direction = node.containerInstructions.direction;
  const gap = node.containerInstructions.gap ?? LAYOUT_DEFAULTS.GAP;
  const totalGaps = gap * Math.max(0, node.children.length - 1);

  // Calculate padding for this axis
  const axisPadding = getAxisPadding(node.containerInstructions.padding, axis).total;

  if (direction === axis) {
    // Children are laid out along the same axis - sum their sizes
    let total = 0;
    for (const child of node.children) {
      const childSize = getChildSize(child, axis, type);

      if (type === 'max' && childSize === Infinity) return Infinity;
      total += childSize;
    }
    return total + totalGaps + axisPadding;
  } else {
    // Children are laid out perpendicular - take the max of their sizes
    let result = 0;
    for (const child of node.children) {
      const childSize = getChildSize(child, axis, type);

      if (type === 'max' && childSize === Infinity) return Infinity;
      result = Math.max(result, childSize);
    }
    return result + axisPadding;
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
 * Calculate the initial offset and spacing adjustments for justify-content
 */
const calculateJustifyOffset = (
  justifyContent: JustifyContent | undefined,
  freeSpace: number,
  childCount: number
): { initialOffset: number; itemSpacing: number } => {
  if (!justifyContent || freeSpace <= 0) {
    return { initialOffset: 0, itemSpacing: 0 };
  }

  switch (justifyContent) {
    case 'end':
      return { initialOffset: freeSpace, itemSpacing: 0 };

    case 'center':
      return { initialOffset: freeSpace / 2, itemSpacing: 0 };

    case 'space-between':
      if (childCount <= 1) {
        return { initialOffset: 0, itemSpacing: 0 };
      }
      return { initialOffset: 0, itemSpacing: freeSpace / (childCount - 1) };

    case 'start':
      return { initialOffset: 0, itemSpacing: 0 };

    default:
      VERIFY_NOT_REACHED();
  }
};

/**
 * Calculate cross-axis alignment offset for a single child
 */
const calculateAlignOffset = (
  alignItems: AlignItems | undefined,
  containerCrossSize: number,
  childCrossSize: number,
  crossPaddingStart: number,
  crossPaddingEnd: number
): number => {
  if (!alignItems || alignItems === 'preserve') {
    return 0; // No change - preserve original position
  }

  const availableCrossSize = containerCrossSize - crossPaddingStart - crossPaddingEnd;

  switch (alignItems) {
    case 'start':
      return crossPaddingStart;

    case 'end':
      return containerCrossSize - childCrossSize - crossPaddingEnd;

    case 'center':
      return crossPaddingStart + (availableCrossSize - childCrossSize) / 2;

    case 'stretch':
      // For stretch, return start position - sizing happens separately
      return crossPaddingStart;

    default:
      VERIFY_NOT_REACHED();
  }
};

/**
 * Calculate cross-axis size for stretch alignment
 */
const getStretchSize = (
  alignItems: AlignItems | undefined,
  containerCrossSize: number,
  crossPaddingStart: number,
  crossPaddingEnd: number,
  child: LayoutNode,
  axis: Axis
): number | undefined => {
  if (alignItems !== 'stretch') return undefined;
  if (child.elementInstructions?.preserveAspectRatio) return undefined;

  const availableCrossSize = containerCrossSize - crossPaddingStart - crossPaddingEnd;
  const crossConstraints = getAxisConstraints(child, axis);

  // When stretching, we want to fill the available space
  // Only respect min constraint, ignore max constraint as stretch should override it
  const minValue = crossConstraints?.min ?? LAYOUT_DEFAULTS.MIN;

  return Math.max(minValue, availableCrossSize);
};

/**
 * Apply aspect ratio preservation for resized children
 */
const applyAspectRatio = (childInfo: ChildInfo[], isHorizontal: boolean): void => {
  for (const info of childInfo) {
    if (
      info.child.elementInstructions?.preserveAspectRatio &&
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
        crossConstraints?.min ?? LAYOUT_DEFAULTS.MIN,
        Math.min(crossConstraints?.max ?? LAYOUT_DEFAULTS.MAX, newCrossSize)
      );
    }
  }
};

const positionComparator = (isHorizontal: boolean) => (a: ChildInfo, b: ChildInfo) => {
  const aPos = isHorizontal ? a.child.bounds.x : a.child.bounds.y;
  const bPos = isHorizontal ? b.child.bounds.x : b.child.bounds.y;
  return aPos - bPos;
};

/**
 * Calculates and applies layout to children of a layout node using a simplified flexbox algorithm.
 *
 * This function implements a complete layout pass including:
 * - Intrinsic size calculation from nested children
 * - Flex-grow and flex-shrink distribution
 * - Aspect ratio preservation
 * - Justify-content and align-items positioning
 * - Container auto-sizing to fit children
 * - Recursive layout of nested containers
 *
 * @param layoutNode - The node whose children should be laid out
 *
 * @remarks
 * The algorithm follows these steps:
 * 1. Skip if layout is disabled or no children exist
 * 2. Collect child information including intrinsic min/max sizes from nested children
 * 3. Calculate available space (accounting for padding and gaps)
 * 4. Distribute space according to flex-grow or flex-shrink factors
 * 5. Apply aspect ratio preservation if elements were resized
 * 6. Auto-resize container if children don't fit
 * 7. Position and size children (with padding and alignment)
 * 8. Recursively layout children's children
 *
 * Children with `isAbsolute: true` are excluded from layout but their children are still processed.
 * The container can grow to accommodate children that don't fit on either axis.
 *
 * @example
 * ```ts
 * const layoutTree = buildLayoutTree(containerNode);
 * layoutChildren(layoutTree);
 * applyLayoutTree(containerNode, layoutTree, uow);
 * ```
 */
export const layoutChildren = (layoutNode: LayoutNode) => {
  // If no container instructions or explicitly disabled, only recurse to children
  if (!layoutNode.containerInstructions || layoutNode.containerInstructions.enabled === false) {
    for (const child of layoutNode.children) {
      layoutChildren(child);
    }
    return;
  }

  if (layoutNode.children.length === 0) return;

  const axis = layoutNode.containerInstructions.direction;
  const gap = layoutNode.containerInstructions.gap ?? LAYOUT_DEFAULTS.GAP;
  const isHorizontal = axis === 'horizontal';
  const padding = layoutNode.containerInstructions.padding;

  // Calculate available space for children (container size minus padding)
  const containerSize = isHorizontal ? layoutNode.bounds.w : layoutNode.bounds.h;
  const mainAxisPadding = getAxisPadding(padding, axis);
  const availableSize = containerSize - mainAxisPadding.total;

  // Collect child information with effective min/max constraints
  // Exclude children with isAbsolute: true
  const childInfo: ChildInfo[] = layoutNode.children
    .filter(child => !child.elementInstructions?.isAbsolute)
    .map(child => {
      const boundingBox = Box.boundingBox([WritableBox.asBox(child.bounds)], true);
      const originalSize = isHorizontal ? boundingBox.w : boundingBox.h;
      const constraints = getAxisConstraints(child, axis);

      const intrinsicMin = getIntrinsicSize(child, axis, 'min');
      const intrinsicMax = getIntrinsicSize(child, axis, 'max');
      const effectiveMin = Math.max(intrinsicMin, constraints?.min ?? LAYOUT_DEFAULTS.MIN);
      const effectiveMax = Math.min(intrinsicMax, constraints?.max ?? LAYOUT_DEFAULTS.MAX);

      return {
        child,
        boundingBox,
        originalSize,
        finalSize: originalSize,
        crossAxisSize: undefined,
        grow: child.elementInstructions?.grow ?? LAYOUT_DEFAULTS.GROW,
        shrink: child.elementInstructions?.shrink ?? LAYOUT_DEFAULTS.SHRINK,
        min: effectiveMin,
        max: effectiveMax
      };
    });

  // Sort children based on their position in the layout direction
  // Stable sort preserves original order when positions are equal
  childInfo.sort(positionComparator(isHorizontal));

  // Calculate available space and determine grow/shrink
  // Use childInfo.length (non-absolute children) instead of all children
  const totalGaps = gap * Math.max(0, childInfo.length - 1);
  const totalOriginalSize = childInfo.reduce((sum, info) => sum + info.originalSize, 0);
  const freeSpace = availableSize - totalGaps - totalOriginalSize;

  const shouldGrow = freeSpace > 0 && childInfo.some(info => info.grow > 0);
  const shouldShrink = freeSpace < 0 && childInfo.some(info => info.shrink > 0);
  const shouldJustify = !shouldGrow && !shouldShrink && freeSpace > 0;

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

  // Check if parent needs to be resized to fit children on the main axis
  const totalFinalSize = childInfo.reduce((sum, info) => sum + info.finalSize, 0);
  const requiredMainAxisSize = totalFinalSize + totalGaps + mainAxisPadding.total;

  let shouldResizeContainer = false;
  if (requiredMainAxisSize > containerSize) {
    // Parent is too small on main axis, resize it to grow
    shouldResizeContainer = true;
  } else if (
    layoutNode.containerInstructions.autoShrink &&
    !shouldGrow &&
    requiredMainAxisSize < containerSize
  ) {
    // Parent is too large on main axis and autoShrink is enabled
    // Only shrink if no children have grow (shouldGrow would be true if any child has grow > 0)
    shouldResizeContainer = true;
  }

  if (shouldResizeContainer) {
    if (isHorizontal) {
      layoutNode.bounds.w = requiredMainAxisSize;
    } else {
      layoutNode.bounds.h = requiredMainAxisSize;
    }
  }

  // Check if parent needs to be resized to fit children on the cross axis
  // Skip auto-sizing when alignItems is 'stretch' - children should fit the container, not vice versa
  const crossAxis: Axis = isHorizontal ? 'vertical' : 'horizontal';
  const crossAxisPadding = getAxisPadding(padding, crossAxis);
  const alignItems = layoutNode.containerInstructions.alignItems;

  if (alignItems !== 'stretch') {
    const maxCrossAxisSize = childInfo.reduce((max, info) => {
      const currentCrossSize = isHorizontal ? info.child.bounds.h : info.child.bounds.w;
      const crossSize = info.crossAxisSize ?? currentCrossSize;
      return Math.max(max, crossSize);
    }, 0);

    const requiredCrossAxisSize = maxCrossAxisSize + crossAxisPadding.total;
    const currentCrossSize = isHorizontal ? layoutNode.bounds.h : layoutNode.bounds.w;

    if (requiredCrossAxisSize > currentCrossSize) {
      // Parent is too small on cross axis, resize it
      if (isHorizontal) {
        layoutNode.bounds.h = requiredCrossAxisSize;
      } else {
        layoutNode.bounds.w = requiredCrossAxisSize;
      }
    }
  }

  // Position and size children (offset by padding and justify-content)
  const paddingLeft = padding?.left ?? 0;
  const paddingTop = padding?.top ?? 0;

  // Container cross-axis size
  const containerCrossSize = isHorizontal ? layoutNode.bounds.h : layoutNode.bounds.w;

  // Calculate justify-content offset if applicable
  const justifyOffset = shouldJustify
    ? calculateJustifyOffset(
        layoutNode.containerInstructions.justifyContent,
        freeSpace,
        childInfo.length
      )
    : { initialOffset: 0, itemSpacing: 0 };

  let currentOffset = (isHorizontal ? paddingLeft : paddingTop) + justifyOffset.initialOffset;

  for (const info of childInfo) {
    const { child, finalSize, crossAxisSize } = info;

    // Calculate cross-axis size (prefer crossAxisSize from aspect ratio, else use current size)
    const currentCrossSize = isHorizontal ? child.bounds.h : child.bounds.w;
    const effectiveCrossSize = crossAxisSize ?? currentCrossSize;

    // Check if we should stretch this child
    const stretchSize = getStretchSize(
      layoutNode.containerInstructions.alignItems,
      containerCrossSize,
      crossAxisPadding.start,
      crossAxisPadding.end,
      child,
      crossAxis
    );

    const finalCrossSize = stretchSize ?? effectiveCrossSize;

    // Determine effective alignment (if stretch fails due to preserveAspectRatio, use center)
    const effectiveAlignItems =
      layoutNode.containerInstructions.alignItems === 'stretch' && stretchSize === undefined
        ? 'center'
        : layoutNode.containerInstructions.alignItems;

    // Calculate cross-axis offset
    const crossOffset = calculateAlignOffset(
      effectiveAlignItems,
      containerCrossSize,
      finalCrossSize,
      crossAxisPadding.start,
      crossAxisPadding.end
    );

    // Set position and size in both axes
    if (isHorizontal) {
      child.bounds.x = currentOffset;
      // Only set cross-axis position if alignItems is specified and not 'preserve'
      if (effectiveAlignItems && effectiveAlignItems !== 'preserve') {
        child.bounds.y = crossOffset; // Apply cross-axis alignment
      }
      if (shouldGrow || shouldShrink) {
        child.bounds.w = finalSize;
        if (crossAxisSize !== undefined) child.bounds.h = crossAxisSize;
      }
      // Apply stretch size if applicable
      if (stretchSize !== undefined) {
        child.bounds.h = stretchSize;
      }
    } else {
      child.bounds.y = currentOffset;
      // Only set cross-axis position if alignItems is specified and not 'preserve'
      if (effectiveAlignItems && effectiveAlignItems !== 'preserve') {
        child.bounds.x = crossOffset; // Apply cross-axis alignment
      }
      if (shouldGrow || shouldShrink) {
        child.bounds.h = finalSize;
        if (crossAxisSize !== undefined) child.bounds.w = crossAxisSize;
      }
      // Apply stretch size if applicable
      if (stretchSize !== undefined) {
        child.bounds.w = stretchSize;
      }
    }

    currentOffset += finalSize + gap + justifyOffset.itemSpacing;
    layoutChildren(child); // Recursively layout children
  }

  // Recursively layout absolute-positioned children (they don't participate in layout but their children might)
  for (const child of layoutNode.children) {
    if (child.elementInstructions?.isAbsolute) {
      layoutChildren(child);
    }
  }
};

// Export internal functions for testing
export const _test = {
  getAxisConstraints,
  getAxisPadding,
  getIntrinsicSize,
  applyGrow,
  applyShrink,
  applyAspectRatio,
  calculateJustifyOffset,
  calculateAlignOffset,
  getStretchSize
};
