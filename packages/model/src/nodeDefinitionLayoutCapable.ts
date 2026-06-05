// LayoutTree

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
  /** Whether container should shrink to fit children when no children have grow set (default: false) */
  autoShrink?: boolean;
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
