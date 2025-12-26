import type { WritableBox } from '@diagram-craft/geometry/box';

export type ContainerLayoutInstructions = {
  direction: 'vertical' | 'horizontal';
};

export type ElementLayoutInstructions = {};

export interface LayoutNode {
  id: string;
  bounds: WritableBox;
  children: LayoutNode[];

  containerInstructions: ContainerLayoutInstructions;
  elementInstructions: ElementLayoutInstructions;
}

export const layoutChildren = (layoutNode: LayoutNode) => {
  if (layoutNode.children.length === 0) return;

  const direction = layoutNode.containerInstructions.direction;
  let currentX = 0;
  let currentY = 0;

  for (const child of layoutNode.children) {
    // Set child's position
    child.bounds.x = currentX;
    child.bounds.y = currentY;

    // Advance position for next child
    if (direction === 'horizontal') {
      currentX += child.bounds.w;
    } else {
      currentY += child.bounds.h;
    }

    // Recursively layout children
    layoutChildren(child);
  }
};
