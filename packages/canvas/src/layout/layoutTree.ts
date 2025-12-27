import { Box, WritableBox } from '@diagram-craft/geometry/box';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export type Axis = 'horizontal' | 'vertical';

export type JustifyContent = 'start' | 'end' | 'center' | 'space-between';

export type AlignItems = 'start' | 'end' | 'center' | 'stretch' | 'preserve';

export type ContainerLayoutInstructions = {
  direction: Axis;
  gap?: number;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  enabled?: boolean;
};

export type ElementLayoutInstructions = {
  width?: { min?: number; max?: number };
  height?: { min?: number; max?: number };
  preserveAspectRatio?: boolean;
  grow?: number;
  shrink?: number;
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

export interface LayoutNode {
  id: string;
  // Relative bounds to parent bounds
  bounds: WritableBox;
  children: LayoutNode[];

  containerInstructions: ContainerLayoutInstructions;
  elementInstructions: ElementLayoutInstructions;
}

type ParentBounds = { x: number; y: number; r: number };
const buildLayoutTreeRecursive = (node: DiagramNode, parentBounds?: ParentBounds): LayoutNode => {
  const layoutProps = node.renderProps.layout;

  const containerInstructions = layoutProps?.container;
  const elementInstructions = layoutProps?.element;

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

export const applyLayoutTree = (node: DiagramNode, layout: LayoutNode, uow: UnitOfWork) => {
  applyLayoutTreeRecursive(node, layout, uow);
};

// Export for testing
export const _test = {
  buildLayoutTreeRecursive,
  applyLayoutTreeRecursive
};
