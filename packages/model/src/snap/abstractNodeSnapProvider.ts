import type { Diagram } from '../diagram';
import type { DiagramNode } from '../diagramNode';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isNode } from '../diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Direction } from '@diagram-craft/geometry/direction';
import { Axis } from '@diagram-craft/geometry/axis';
import { Range } from '@diagram-craft/geometry/range';
import type { EligibleNodePredicate } from './snapManager';

/**
 * Abstract base class for snap providers that work with diagram nodes
 *
 * This class provides common functionality for snap providers that need to:
 * - Find nodes in the diagram that are eligible for snapping
 * - Categorize nodes by their directional relationship to a target box
 * - Extract geometric information from node bounds
 * - Filter nodes based on visibility, eligibility, and spatial relationships
 */
export abstract class AbstractNodeSnapProvider {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly eligibleNodePredicate: EligibleNodePredicate
  ) {}

  /**
   * Get the coordinate of a box's edge in the specified direction
   *
   * This is a fundamental helper for extracting position information from boxes
   * based on directional relationships.
   *
   * @param b - The box to get the coordinate from
   * @param dir - The direction/edge to get the coordinate for
   * @returns The coordinate value for the specified edge
   *
   * Direction mappings:
   * - 'n' (north): Top edge (y coordinate)
   * - 's' (south): Bottom edge (y + height)
   * - 'w' (west): Left edge (x coordinate)
   * - 'e' (east): Right edge (x + width)
   */
  protected getEdgePosition(b: Box, dir: Direction) {
    switch (dir) {
      case 'e':
        return b.x + b.w;
      case 'w':
        return b.x;
      case 'n':
        return b.y;
      case 's':
        return b.y + b.h;
    }
  }

  /**
   * Get the range (extent) of a box along the specified axis
   *
   * This is used to determine where boxes overlap or align along horizontal or vertical axes.
   * Essential for determining if nodes can meaningfully snap together.
   *
   * @param b - The box to get the range from
   * @param axis - The axis to get the range along ('h' for horizontal, 'v' for vertical)
   * @returns Range representing the box's extent along the axis
   *
   * Examples:
   * - Horizontal axis ('h'): Returns [x, x + width] representing left to right extent
   * - Vertical axis ('v'): Returns [y, y + height] representing top to bottom extent
   */
  protected getRange(b: Box, axis: Axis): Range {
    if (axis === 'h') {
      return [b.x, b.x + b.w]; // Horizontal range: left edge to right edge
    } else {
      return [b.y, b.y + b.h]; // Vertical range: top edge to bottom edge
    }
  }

  /**
   * Find and categorize all nodes that are viable snap targets for the given box
   *
   * This is the core method that filters and organizes nodes for snapping operations.
   * It applies multiple filtering criteria and then categorizes qualifying nodes
   * by their directional relationship to the target box.
   *
   * Filtering criteria (nodes must pass ALL of these):
   * 1. Must be a visible diagram element (not hidden)
   * 2. Must be a node (not an edge or other element type)
   * 3. Must not be rotated (rotation complicates edge calculations and is not yet supported)
   * 4. Must not be a label node (labels are positioned automatically)
   * 5. Must pass the eligibleNodePredicate (usually excludes nodes being moved)
   * 6. Must not intersect/overlap with the target box
   * 7. Must have alignment potential (overlapping ranges on at least one axis)
   *
   * Directional categorization:
   * - North: Nodes above the box that could align horizontally
   * - South: Nodes below the box that could align horizontally
   * - West: Nodes to the left of the box that could align vertically
   * - East: Nodes to the right of the box that could align vertically
   *
   * @param box - The target box to find snap candidates for
   * @returns Object with arrays of nodes categorized by direction (n, s, e, w)
   */
  protected getViableNodes(box: Box) {
    // Get the horizontal and vertical ranges of the target box for overlap detection
    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    // Initialize result object with empty arrays for each direction
    const result: Record<Direction, Array<DiagramNode>> = { n: [], w: [], e: [], s: [] };

    // Examine all visible elements in the diagram
    for (const node of this.diagram.visibleElements()) {
      // Apply filtering criteria - skip nodes that don't meet requirements
      if (!isNode(node)) continue; // Must be a node (not edge, etc.)
      if (node.bounds.r !== 0) continue; // Must not be rotated
      if (node.isLabelNode()) continue; // Skip label nodes (auto-positioned)
      if (!this.eligibleNodePredicate(node.id)) continue; // Must pass eligibility filter
      if (Box.intersects(node.bounds, box)) continue; // Must not overlap with target box

      // Only consider nodes that have alignment potential:
      // Either their horizontal ranges overlap (can align vertically) OR
      // their vertical ranges overlap (can align horizontally)
      if (
        Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) || // Horizontal alignment potential
        Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange) // Vertical alignment potential
      ) {
        // Categorize the node by its directional relationship to the target box
        if (this.getEdgePosition(node.bounds, 's') < box.y) {
          // Node's bottom edge is above the box's top edge → North
          result.n.push(node);
        } else if (this.getEdgePosition(node.bounds, 'e') < box.x) {
          // Node's right edge is left of the box's left edge → West
          result.w.push(node);
        } else if (node.bounds.x > this.getEdgePosition(box, 'e')) {
          // Node's left edge is right of the box's right edge → East
          result.e.push(node);
        } else if (node.bounds.y > this.getEdgePosition(box, 's')) {
          // Node's top edge is below the box's bottom edge → South
          result.s.push(node);
        } else {
          // This should never happen given our filtering criteria
          VERIFY_NOT_REACHED();
        }
      }
    }
    return result;
  }
}
