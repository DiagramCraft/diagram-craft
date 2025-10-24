import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import { Highlight } from '@diagram-craft/model/selection';
import { MagnetOfType } from './magnet';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { getTypedKeys } from '@diagram-craft/utils/object';
import { smallest } from '@diagram-craft/utils/array';

/**
 * Snap provider for matching node dimensions during resize operations
 *
 * This provider creates "size magnets" that allow elements being resized to snap to the same
 * width or height as existing nodes in the diagram. It helps maintain visual consistency by
 * making it easy to create elements with matching dimensions.
 *
 * Key features:
 * - Finds the closest node in each direction (north, south, east, west) that has range overlap
 * - Creates magnets that resize the current element to match the width/height of target nodes
 * - Generates two magnets per viable direction: one for forward resize and one for backward resize
 * - Only considers nodes that don't intersect with the element being resized
 * - Provides visual feedback showing both the current element's size and the target node's size
 *
 * Example scenarios:
 * - Dragging the bottom edge of a rectangle to match the height of a nearby rectangle
 * - Dragging the right edge of a shape to match the width of an adjacent shape
 * - Resizing any element to have consistent dimensions with existing elements in the layout
 *
 * The magnets are positioned at the edges where resizing would achieve the target dimension,
 * making it intuitive for users to snap to matching sizes during resize operations.
 */
export class NodeSizeSnapProvider extends AbstractNodeSnapProvider implements SnapProvider<'size'> {
  /**
   * Generate size magnets for matching node dimensions
   *
   * This method creates magnets that allow the element being resized to snap to the same
   * width or height as nearby nodes. The algorithm:
   *
   * 1. Finds all viable nodes in each direction that don't intersect with the current box
   * 2. For each direction with viable nodes, selects the closest node by center-to-center distance
   * 3. Determines the target dimension (width for north/south directions, height for east/west)
   * 4. Creates two magnets per direction:
   *    - Forward magnet: Positions the resize handle to achieve target size in the forward direction
   *    - Backward magnet: Positions the resize handle to achieve target size in the backward direction
   *
   * The magnets are positioned at the edges where the resize operation would result in the
   * target dimension being achieved.
   *
   * @param box - The element being resized
   * @returns Array of size magnets with positioning information
   */
  getMagnets(box: Box): MagnetOfType<'size'>[] {
    // Get the center point of the current box for distance calculations
    const center = Box.center(box);

    // Find all viable nodes categorized by direction (using inherited method)
    const viableNodes = this.getViableNodes(box);

    const magnets: MagnetOfType<'size'>[] = [];

    // Process each direction that has viable nodes
    for (const d of getTypedKeys(viableNodes)) {
      if (viableNodes[d].length === 0) continue; // Skip directions with no viable nodes

      // We want the closest node for the most relevant size matching
      const first = smallest(
        viableNodes[d],
        (a, b) =>
          Point.squareDistance(center, Box.center(a.bounds)) -
          Point.squareDistance(center, Box.center(b.bounds))
      )!;

      // Determine which dimension we're working with based on direction:
      // - North/South directions: match height (vertical resizing)
      // - East/West directions: match width (horizontal resizing)
      const dir: keyof Extent = d === 'n' || d === 's' ? 'h' : 'w';
      const axis: Axis = d === 'n' || d === 's' ? 'h' : 'v';

      // Get the target dimension from the closest node and current box dimension
      const otherDimension = first.bounds[dir]; // Target dimension to match
      const selfDim = box[dir]; // Current dimension of the box being resized

      // Calculate the difference needed to achieve the target dimension
      const diff = otherDimension - selfDim;

      // Create forward direction magnet
      // This magnet allows resizing in the "forward" direction to achieve target size
      magnets.push({
        type: 'size',
        axis,
        matchDirection: d,
        respectDirection: false,
        node: first,
        size: otherDimension,
        line:
          dir === 'h'
            ? // For height matching: create horizontal line at: bottom edge + difference
              Line.horizontal(box.y + box.h + diff, [box.x, box.x + box.w])
            : // For width matching: create vertical line at: right edge + difference
              Line.vertical(box.x + box.w + diff, [box.y, box.y + box.h]),
        distancePairs: [] // Will be populated in highlight() method
      });

      // Create backward direction magnet
      // This magnet allows resizing in the "backward" direction to achieve target size
      magnets.push({
        type: 'size',
        axis,
        matchDirection: d,
        respectDirection: false,
        node: first,
        size: otherDimension,
        line:
          dir === 'h'
            ? // For height matching: create horizontal line at: top edge - difference
              Line.horizontal(box.y - diff, [box.x, box.x + box.w])
            : // For width matching: create vertical line at: left edge - difference
              Line.vertical(box.x - diff, [box.y, box.y + box.h]),
        distancePairs: []
      });
    }

    return magnets;
  }

  /**
   * Create highlight visualization for size-based snapping
   *
   * When an element snaps to a size magnet, this creates visual guides showing:
   * 1. The current element's dimension being resized
   * 2. The target node's matching dimension for comparison
   *
   * The distance pairs are used to draw measurement lines that help users understand
   * the size relationship between the elements.
   *
   * @param box - The element that snapped to the size magnet
   * @param match - The matching magnet pair containing size information
   * @param _axis - The axis along which the size matching occurs (not used in this implementation)
   * @returns Highlight object with visual guide information
   */
  highlight(box: Box, match: MatchingMagnetPair<'size'>, _axis: Axis): Highlight {
    if (match.matching.axis === 'h') {
      // For horizontal axis (height matching), create vertical measurement lines

      // Add distance pair for the current element's height
      match.matching.distancePairs.push({
        distance: match.matching.size, // The target size value
        pointA: Line.midpoint(Box.line(box, 'n')), // Top edge midpoint
        pointB: Line.midpoint(Box.line(box, 's')) // Bottom edge midpoint
      });

      // Add distance pair for the reference node's height
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'n')), // Reference node top
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 's')) // Reference node bottom
      });
    } else {
      // For vertical axis (width matching), create horizontal measurement lines

      // Add distance pair for the current element's width
      match.matching.distancePairs.push({
        distance: match.matching.size, // The target size value
        pointA: Line.midpoint(Box.line(box, 'e')), // Right edge midpoint
        pointB: Line.midpoint(Box.line(box, 'w')) // Left edge midpoint
      });

      // Add distance pair for the reference node's width
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'e')), // Reference node right
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 'w')) // Reference node left
      });
    }

    return {
      line: match.matching.line, // The magnet line where snapping occurred
      matchingMagnet: match.matching, // Contains the updated distance pairs for visualization
      selfMagnet: match.self // The source magnet from the element being resized
    };
  }

  /**
   * Filter/consolidate size highlights
   *
   * Size highlights don't need special filtering or consolidation,
   * as each size magnet represents a unique size matching relationship.
   */
  filterHighlights(highlights: Highlight[]): Highlight[] {
    return highlights;
  }
}
