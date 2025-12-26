import { Box, WritableBox } from '@diagram-craft/geometry/box';

export type ContainerLayoutInstructions = {
  direction: 'vertical' | 'horizontal';
};

export type ElementLayoutInstructions = {};

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
  let currentOffset = 0;

  for (const child of layoutNode.children) {
    // Get axis-aligned bounding box to account for rotation
    const childBoundingBox = Box.boundingBox([WritableBox.asBox(child.bounds)], true);

    // Set child's position only in the layout direction
    if (direction === 'horizontal') {
      child.bounds.x = currentOffset;
      currentOffset += childBoundingBox.w;
    } else {
      child.bounds.y = currentOffset;
      currentOffset += childBoundingBox.h;
    }

    // Recursively layout children
    layoutChildren(child);
  }
};
