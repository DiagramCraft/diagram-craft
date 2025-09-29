
import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import { Highlight } from '../selectionState';
import { Magnet, MagnetOfType } from './magnet';
import { isNode } from '../diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Range } from '@diagram-craft/geometry/range';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Point } from '@diagram-craft/geometry/point';
import { unique } from '@diagram-craft/utils/array';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';

/**
 * Helper functions to find the bounding extents of exactly two boxes
 * Used for creating highlight lines that span across both the source and target elements
 */
const minX = (boxA: Box, boxB: Box) => Math.min(boxA.x, boxB.x, boxA.x + boxA.w, boxB.x + boxB.w);
const maxX = (boxA: Box, boxB: Box) => Math.max(boxA.x, boxB.x, boxA.x + boxA.w, boxB.x + boxB.w);
const minY = (boxA: Box, boxB: Box) => Math.min(boxA.y, boxB.y, boxA.y + boxA.h, boxB.y + boxB.h);
const maxY = (boxA: Box, boxB: Box) => Math.max(boxA.y, boxB.y, boxA.y + boxA.h, boxB.y + boxB.h);

/**
 * Tuple representing a magnet paired with its distance from the target element
 * Used for sorting magnets by proximity to find the most relevant snap targets
 */
type AnchorWithDistance = MagnetOfType<'node'> & { distance: number };

/**
 * Comparison function for sorting magnets by distance (closest first)
 * Sorts in descending order of distance (b[1] - a[1]) so that closest magnets have higher priority
 */
const compareFn = (a: AnchorWithDistance, b: AnchorWithDistance) => b.distance - a.distance;

/**
 * Snap provider for node-to-node alignment
 *
 * This provider creates "node magnets" that allow elements to snap to the edges and centers
 * of existing nodes in the diagram. It enables precise alignment by creating magnetic lines
 * at key positions of other nodes.
 *
 * Algorithm overview:
 * 1. For each eligible node in the diagram, generate all possible magnets (center + edges)
 * 2. Filter magnets based on range overlap between source and target elements
 * 3. Extend magnetic lines to span the full diagram viewport
 * 4. Sort magnets by distance to prioritize closest snap targets
 * 5. Remove duplicate magnets at the same position
 *
 * Example scenarios:
 * - Moving a rectangle to align with the left edge of another rectangle
 * - Centering text horizontally with respect to an existing shape
 * - Aligning multiple elements along their bottom edges
 * - Creating grid-like layouts by snapping to existing element positions
 */
export class NodeSnapProvider extends AbstractNodeSnapProvider implements SnapProvider<'node'> {

  /**
   * Generate node-based magnets for snapping alignment
   *
   * This method creates magnets from all eligible nodes in the diagram that can serve as
   * snap targets for the given box. The algorithm:
   *
   * 1. Filters nodes based on visibility, type, and eligibility criteria
   * 2. For each qualifying node, generates all possible magnets (edges + centers)
   * 3. Filters magnets based on range overlap between source box and target node
   * 4. Extends magnet lines to span the full diagram viewport for visual clarity
   * 5. Categorizes magnets by orientation (horizontal vs vertical)
   * 6. Sorts magnets by distance from the source box center
   * 7. Removes duplicates at the same position
   *
   * Range overlap filtering:
   * Only creates magnets for nodes that have some alignment potential with the source box.
   * A node must overlap with the source box on at least one axis (horizontal OR vertical)
   * to be considered a viable snap target.
   *
   * Line extension:
   * Magnetic lines are extended to span the entire diagram viewport, making them easier
   * to see and interact with during snapping operations.
   */
  getMagnets(box: Box): MagnetOfType<'node'>[] {
    // Separate collections for horizontal and vertical magnets
    const dest: Record<Axis, AnchorWithDistance[]> = { h: [], v: [] };
    const center = Box.center(box);

    // Get the ranges of the source box for overlap detection
    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    // Process all visible elements in the diagram
    for (const node of this.diagram.allElements()) {
      // Apply filtering criteria - skip elements that don't meet requirements
      if (!isNode(node)) continue; // Must be a node (not edge, etc.)
      if (node.isLabelNode()) continue; // Skip label nodes (auto-positioned)
      if (!this.eligibleNodePredicate(node.id)) continue; // Must pass eligibility filter

      // Range overlap filtering: only consider nodes with alignment potential
      // A node must overlap with the source box on at least one axis to be useful
      // TODO: We might be able to filter out even more here
      //       by considering the direction of the magnet line
      if (
        !Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) &&
        !Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
      ) {
        continue;
      }

      // Generate all possible magnets for this node (center lines + edges)
      for (const other of Magnet.sourceMagnetsForNode(node)) {
        const magnet: AnchorWithDistance = {
          ...other,
          type: 'node',
          node,
          distance: Point.squareDistance(center, Box.center(node.bounds))
        };

        // Process based on magnet orientation
        if (Line.isHorizontal(magnet.line)) {
          // Extend horizontal magnets to span the full diagram width
          magnet.line = Line.horizontal(magnet.line.to.y, [0, this.diagram.viewBox.dimensions.w]);
          dest.h.push(magnet);
        } else {
          // Extend vertical magnets to span the full diagram height
          magnet.line = Line.vertical(magnet.line.to.x, [0, this.diagram.viewBox.dimensions.h]);
          dest.v.push(magnet);
        }
      }
    }

    // Sort and deduplicate magnets
    // Sort by distance (closest first) and remove duplicates at the same position
    if (dest.h.length > 1) dest.h = unique(dest.h.sort(compareFn), e => e.line.from.y);
    if (dest.v.length > 1) dest.v = unique(dest.v.sort(compareFn), e => e.line.from.x);

    // TODO: At this point, it should be possible to further reduce the number of magnets
    //       by removing magnets that are close to other magnets but further away from the source
    //       This is probably only worth the computational resources in case the number of
    //       magnets exceeds some given threshold

    // Return combined array of horizontal and vertical magnets
    return [...dest.h, ...dest.v];
  }

  /**
   * Create highlights for node-based snapping
   *
   * When an element snaps to a node magnet, this creates a visual highlight line that
   * spans between the source element and the target node.
   *
   * Highlight line positioning:
   * - For horizontal magnets: Creates a horizontal line spanning from the leftmost edge
   *   of either element to the rightmost edge of either element
   * - For vertical magnets: Creates a vertical line spanning from the topmost edge
   *   of either element to the bottommost edge of either element
   */
  highlight(box: Box, match: MatchingMagnetPair<'node'>, _axis: Axis): Highlight {
    const mBox = match.matching.node.bounds;
    return {
      line: Line.isHorizontal(match.matching.line)
        ? Line.horizontal(match.matching.line.from.y, [minX(mBox, box), maxX(mBox, box)])
        : Line.vertical(match.matching.line.from.x, [minY(mBox, box), maxY(mBox, box)]),
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  /**
   * Filter/consolidate node highlights
   *
   * Node highlights don't need special filtering or consolidation,
   * as each node magnet represents a unique alignment relationship.
   * This method simply passes through all highlights unchanged.
   */
  filterHighlights(guides: Highlight[]): Highlight[] {
    return guides;
  }
}
