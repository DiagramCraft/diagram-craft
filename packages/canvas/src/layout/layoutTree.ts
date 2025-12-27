import { WritableBox } from '@diagram-craft/geometry/box';
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

export const buildLayoutTree = (node: DiagramNode): LayoutNode => {
  const layoutProps = node.renderProps.layout;

  const containerInstructions = layoutProps?.container;
  const elementInstructions = layoutProps?.element;

  // Build children recursively (only for DiagramNode children)
  const children: LayoutNode[] = node.children
    .filter((child): child is DiagramNode => child.type === 'node')
    .map(child => buildLayoutTree(child));

  return {
    id: node.id,
    bounds: { ...node.bounds, _discriminator: 'rw' as const },
    children,
    containerInstructions,
    elementInstructions
  };
};

export const applyLayoutTree = (node: DiagramNode, layout: LayoutNode, uow: UnitOfWork) => {
  // Update the node's bounds from the layout
  uow.snapshot(node);
  node.setBounds(WritableBox.asBox(layout.bounds), uow);

  // Apply layout recursively to children
  // Match children by ID since the order might have changed
  const childLayoutMap = new Map(layout.children.map(child => [child.id, child]));

  for (const child of node.children) {
    if (child.type === 'node') {
      const childLayout = childLayoutMap.get(child.id);
      if (childLayout) {
        applyLayoutTree(child as DiagramNode, childLayout, uow);
      }
    }
  }
};
