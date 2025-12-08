import type { Point } from '@diagram-craft/geometry/point';
import type { Graph } from './graph';
import { extractMaximalTree } from './transformation';

/**
 * Layout options for tree layout algorithm
 */
export type TreeLayoutOptions = {
  /** Horizontal spacing between sibling nodes (default: 1) */
  horizontalSpacing?: number;
  /** Vertical spacing between levels (default: 1) */
  verticalSpacing?: number;
  /** Direction of the tree layout (default: 'down') */
  direction?: 'down' | 'up' | 'left' | 'right';
};

/**
 * Internal node structure for the Reingold-Tilford tree layout algorithm.
 *
 * This structure maintains state during the two-pass layout process:
 * - First pass (firstWalk): Computes preliminary x-coordinates in a post-order traversal
 * - Second pass (secondWalk): Computes final positions by adding modifiers
 */
type TreeNode<VK> = {
  /** Unique identifier for this node */
  id: VK;

  /** Child nodes in the tree */
  children: TreeNode<VK>[];

  /** Parent node (undefined for root) */
  parent?: TreeNode<VK>;

  /** Final x-coordinate after layout */
  x: number;

  /** Final y-coordinate (depth level in tree) */
  y: number;

  /**
   * Modifier value that gets added to descendants' x-coordinates.
   * Used to shift entire subtrees horizontally.
   */
  mod: number;

  /**
   * Threading pointer used to traverse tree contours.
   * Points to the next node to visit when walking the left or right contour
   * of a subtree during the apportion phase.
   */
  thread?: TreeNode<VK>;

  /**
   * Ancestor pointer used during the apportion phase.
   * Helps determine which subtrees need to be shifted to avoid overlaps.
   */
  ancestor: TreeNode<VK>;

  /**
   * Preliminary x-coordinate computed during first walk.
   * For leaf nodes: relative position among siblings.
   * For internal nodes: midpoint of children's prelim values.
   */
  prelim: number;

  /**
   * Change value used to distribute spacing adjustments.
   * Accumulates the per-unit spacing change for descendants.
   */
  change: number;

  /**
   * Total shift amount to be applied to this subtree.
   * Used to move sibling subtrees apart to prevent overlaps.
   */
  shift: number;

  /**
   * Sequential number assigned during traversal.
   * Used to compute the number of subtrees between two nodes.
   */
  number: number;
};

/**
 * Builds a tree structure from a graph starting at a root vertex.
 * Uses extractMaximalTree to get the tree subgraph, then builds parent-child relationships.
 */
const buildTree = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  rootId: VK
): TreeNode<VK> | undefined => {
  const treeData = extractMaximalTree(graph, rootId);
  if (!treeData) {
    return undefined;
  }

  const createNode = (id: VK): TreeNode<VK> => {
    const node: TreeNode<VK> = {
      id,
      children: [],
      x: 0,
      y: 0,
      mod: 0,
      ancestor: undefined as any,
      prelim: 0,
      change: 0,
      shift: 0,
      number: 0
    };
    node.ancestor = node;
    return node;
  };

  const buildNode = (vertexId: VK, parent?: TreeNode<VK>): TreeNode<VK> => {
    const node = createNode(vertexId);
    node.parent = parent;
    const childVertices = treeData.children.get(vertexId) ?? [];

    for (const childVertex of childVertices) {
      const childNode = buildNode(childVertex.id, node);
      node.children.push(childNode);
    }

    return node;
  };

  return buildNode(rootId);
};

/**
 * Implements the Reingold-Tilford algorithm for tree layout.
 * This algorithm produces aesthetically pleasing tree layouts with:
 * - Parents centered over children
 * - Minimal width
 * - No edge crossings
 * - Consistent spacing
 */
const reingoldTilford = <VK>(root: TreeNode<VK>, spacing: number): void => {
  let nextNumber = 0;

  const nextLeft = (node: TreeNode<VK>): TreeNode<VK> | undefined => {
    return node.children.length > 0 ? node.children[0] : node.thread;
  };

  const nextRight = (node: TreeNode<VK>): TreeNode<VK> | undefined => {
    return node.children.length > 0 ? node.children[node.children.length - 1] : node.thread;
  };

  const getLeftSibling = (node: TreeNode<VK>): TreeNode<VK> | undefined => {
    if (!node.parent) return undefined;

    const siblings = node.parent.children;
    const index = siblings.indexOf(node);

    return index > 0 ? siblings[index - 1] : undefined;
  };

  const moveSubtree = (wm: TreeNode<VK>, wp: TreeNode<VK>, shift: number): void => {
    const subtrees = wp.number - wm.number;
    wp.change -= shift / subtrees;
    wp.shift += shift;
    wm.change += shift / subtrees;
    wp.prelim += shift;
    wp.mod += shift;
  };

  const executeShifts = (node: TreeNode<VK>): void => {
    let shift = 0;
    let change = 0;

    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i]!;
      child.prelim += shift;
      child.mod += shift;
      change += child.change;
      shift += child.shift + change;
    }
  };

  const ancestor = (
    vil: TreeNode<VK>,
    v: TreeNode<VK>,
    defaultAncestor: TreeNode<VK>
  ): TreeNode<VK> => {
    if (vil.ancestor.parent === v.parent) {
      return vil.ancestor;
    }
    return defaultAncestor;
  };

  const apportion = (
    v: TreeNode<VK>,
    defaultAncestor: TreeNode<VK>,
    spacing: number
  ): TreeNode<VK> => {
    const w = getLeftSibling(v);
    if (w) {
      let vInnerRight = v;
      let vOuterRight = v;
      let vInnerLeft = w;
      let vOuterLeft = v.parent?.children[0] ?? v;

      let sInnerRight = vInnerRight.mod;
      let sOuterRight = vOuterRight.mod;
      let sInnerLeft = vInnerLeft.mod;
      let sOuterLeft = vOuterLeft.mod;

      while (nextRight(vInnerLeft) && nextLeft(vInnerRight)) {
        vInnerLeft = nextRight(vInnerLeft)!;
        vInnerRight = nextLeft(vInnerRight)!;
        vOuterLeft = nextLeft(vOuterLeft)!;
        vOuterRight = nextRight(vOuterRight)!;

        vOuterRight.ancestor = v;
        const shift = vInnerLeft.prelim + sInnerLeft - (vInnerRight.prelim + sInnerRight) + spacing;

        if (shift > 0) {
          moveSubtree(ancestor(vInnerLeft, v, defaultAncestor), v, shift);
          sInnerRight += shift;
          sOuterRight += shift;
        }

        sInnerLeft += vInnerLeft.mod;
        sInnerRight += vInnerRight.mod;
        sOuterLeft += vOuterLeft.mod;
        sOuterRight += vOuterRight.mod;
      }

      if (nextRight(vInnerLeft) && !nextRight(vOuterRight)) {
        vOuterRight.thread = nextRight(vInnerLeft);
        vOuterRight.mod += sInnerLeft - sOuterRight;
      }

      if (nextLeft(vInnerRight) && !nextLeft(vOuterLeft)) {
        vOuterLeft.thread = nextLeft(vInnerRight);
        vOuterLeft.mod += sInnerRight - sOuterLeft;
        defaultAncestor = v;
      }
    }

    return defaultAncestor;
  };

  const firstWalk = (node: TreeNode<VK>, leftSibling?: TreeNode<VK>): void => {
    node.number = nextNumber++;

    if (node.children.length === 0) {
      // Leaf node
      if (leftSibling) {
        node.prelim = leftSibling.prelim + spacing;
      } else {
        node.prelim = 0;
      }
    } else {
      // Internal node
      let defaultAncestor = node.children[0]!;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;
        firstWalk(child, i > 0 ? node.children[i - 1] : undefined);
        defaultAncestor = apportion(child, defaultAncestor, spacing);
      }

      executeShifts(node);

      const leftmost = node.children[0]!;
      const rightmost = node.children[node.children.length - 1]!;
      const midpoint = (leftmost.prelim + rightmost.prelim) / 2;

      if (leftSibling) {
        node.prelim = leftSibling.prelim + spacing;
        node.mod = node.prelim - midpoint;
      } else {
        node.prelim = midpoint;
      }
    }
  };

  const secondWalk = (node: TreeNode<VK>, m: number, depth: number): void => {
    node.x = node.prelim + m;
    node.y = depth;

    for (const child of node.children) {
      secondWalk(child, m + node.mod, depth + 1);
    }
  };

  firstWalk(root);
  secondWalk(root, -root.prelim, 0);
};

/**
 * Collects positions from tree nodes into a map
 */
const collectPositions = <VK>(
  node: TreeNode<VK>,
  positions: Map<VK, Point>,
  horizontalSpacing: number,
  verticalSpacing: number,
  direction: 'down' | 'up' | 'left' | 'right'
): void => {
  let point: Point;

  switch (direction) {
    case 'down':
      point = { x: node.x * horizontalSpacing || 0, y: node.y * verticalSpacing || 0 };
      break;
    case 'up':
      point = { x: node.x * horizontalSpacing || 0, y: -node.y * verticalSpacing || 0 };
      break;
    case 'left':
      point = { x: -node.y * verticalSpacing || 0, y: node.x * horizontalSpacing || 0 };
      break;
    case 'right':
      point = { x: node.y * verticalSpacing || 0, y: node.x * horizontalSpacing || 0 };
      break;
  }

  positions.set(node.id, point);

  for (const child of node.children) {
    collectPositions(child, positions, horizontalSpacing, verticalSpacing, direction);
  }
};

/**
 * Lays out vertices in a tree structure using the Reingold-Tilford algorithm.
 *
 * This algorithm creates aesthetically pleasing tree layouts with:
 * - Parents centered over their children
 * - Minimal width while maintaining spacing
 * - No edge crossings
 * - Consistent spacing between nodes
 *
 * @param graph - The graph to layout
 * @param rootId - The ID of the root vertex to start the tree from
 * @param options - Layout options
 * @returns Map of vertex IDs to 2D positions
 *
 * @example
 * ```ts
 * const positions = layoutTree(graph, 'root', {
 *   horizontalSpacing: 2,
 *   verticalSpacing: 1.5,
 *   direction: 'down'
 * });
 * ```
 */
export const layoutTree = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  rootId: VK,
  options: TreeLayoutOptions = {}
): Map<VK, Point> => {
  const { horizontalSpacing = 1, verticalSpacing = 1, direction = 'down' } = options;

  const tree = buildTree(graph, rootId);
  if (!tree) {
    return new Map();
  }

  reingoldTilford(tree, 1);

  const positions = new Map<VK, Point>();
  collectPositions(tree, positions, horizontalSpacing, verticalSpacing, direction);

  return positions;
};
