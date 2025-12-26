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

export const layoutChildren = (layoutNode: LayoutNode) => {
  if (layoutNode.children.length === 0) return;

  const direction = layoutNode.containerInstructions.direction;
  const gap = layoutNode.containerInstructions.gap ?? 0;
  const isHorizontal = direction === 'horizontal';

  // Calculate container size in main axis
  const containerSize = isHorizontal ? layoutNode.bounds.w : layoutNode.bounds.h;

  // Collect child information
  const childInfo = layoutNode.children.map(child => {
    const boundingBox = Box.boundingBox([WritableBox.asBox(child.bounds)], true);
    const originalSize = isHorizontal ? boundingBox.w : boundingBox.h;
    const constraints = isHorizontal
      ? child.elementInstructions.width
      : child.elementInstructions.height;

    return {
      child,
      boundingBox,
      originalSize,
      finalSize: originalSize,
      crossAxisSize: undefined as number | undefined,
      grow: child.elementInstructions.grow ?? 0,
      shrink: child.elementInstructions.shrink ?? 0,
      min: constraints?.min ?? 0,
      max: constraints?.max ?? Infinity
    };
  });

  // Calculate total size and free space
  const totalGaps = gap * Math.max(0, layoutNode.children.length - 1);
  const totalOriginalSize = childInfo.reduce((sum, info) => sum + info.originalSize, 0);
  const availableSpace = containerSize - totalGaps;
  const freeSpace = availableSpace - totalOriginalSize;

  // Check if we should grow or shrink
  const shouldGrow = freeSpace > 0 && childInfo.some(info => info.grow > 0);
  const shouldShrink = freeSpace < 0 && childInfo.some(info => info.shrink > 0);

  if (shouldGrow) {
    // Distribute extra space based on grow factors
    const totalGrow = childInfo.reduce((sum, info) => sum + info.grow, 0);

    for (const info of childInfo) {
      if (info.grow > 0) {
        const extraSpace = (freeSpace * info.grow) / totalGrow;
        info.finalSize = Math.min(info.max, info.originalSize + extraSpace);
      }
    }
  } else if (shouldShrink) {
    // Reduce sizes based on shrink factors (weighted by original size)
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
  }

  // Calculate cross-axis sizes for elements with preserveAspectRatio
  if (shouldGrow || shouldShrink) {
    for (const info of childInfo) {
      if (
        info.child.elementInstructions.preserveAspectRatio &&
        info.finalSize !== info.originalSize
      ) {
        // Calculate aspect ratio from original bounds
        const originalW = info.child.bounds.w;
        const originalH = info.child.bounds.h;
        const aspectRatio = originalW / originalH;

        if (isHorizontal) {
          // Main axis is width, cross axis is height
          const newHeight = info.finalSize / aspectRatio;
          const heightConstraints = info.child.elementInstructions.height;
          info.crossAxisSize = Math.max(
            heightConstraints?.min ?? 0,
            Math.min(heightConstraints?.max ?? Infinity, newHeight)
          );
        } else {
          // Main axis is height, cross axis is width
          const newWidth = info.finalSize * aspectRatio;
          const widthConstraints = info.child.elementInstructions.width;
          info.crossAxisSize = Math.max(
            widthConstraints?.min ?? 0,
            Math.min(widthConstraints?.max ?? Infinity, newWidth)
          );
        }
      }
    }
  }

  // Position and size children
  let currentOffset = 0;

  for (const info of childInfo) {
    const child = info.child;

    // Set position only in the layout direction
    // Update size only if we actually grew or shrank
    if (isHorizontal) {
      child.bounds.x = currentOffset;
      if (shouldGrow || shouldShrink) {
        child.bounds.w = info.finalSize;
        // Apply cross-axis size if preserveAspectRatio
        if (info.crossAxisSize !== undefined) {
          child.bounds.h = info.crossAxisSize;
        }
      }
    } else {
      child.bounds.y = currentOffset;
      if (shouldGrow || shouldShrink) {
        child.bounds.h = info.finalSize;
        // Apply cross-axis size if preserveAspectRatio
        if (info.crossAxisSize !== undefined) {
          child.bounds.w = info.crossAxisSize;
        }
      }
    }

    currentOffset += info.finalSize + gap;

    // Recursively layout children
    layoutChildren(child);
  }
};
