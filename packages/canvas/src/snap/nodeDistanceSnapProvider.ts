import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import { Highlight } from '@diagram-craft/model/selection';
import { DistancePairWithRange, MagnetOfType } from './magnet';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';
import { Direction } from '@diagram-craft/geometry/direction';
import { Range } from '@diagram-craft/geometry/range';
import { Axis } from '@diagram-craft/geometry/axis';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Point } from '@diagram-craft/geometry/point';

/**
 * Direction configuration for distance calculations
 * Maps each direction to its properties needed for distance-based snapping:
 * - dir: The direction itself (n/s/e/w)
 * - oppositeDir: The opposite direction (used to find the far edge of elements)
 * - axis: The axis that elements align along for this direction (h for n/s, v for e/w)
 * - oppositeAxis: The orthogonal axis (the axis along which distance is measured)
 * - sign: Direction multiplier (-1 for n/w, 1 for s/e) for distance calculations
 */
const directions: Record<
  Direction,
  {
    dir: Direction;
    oppositeDir: Direction;
    sign: 1 | -1;
    axis: Axis;
    oppositeAxis: Axis;
  }
> = {
  n: { dir: 'n', oppositeDir: 's', axis: 'h', oppositeAxis: 'v', sign: -1 },
  s: { dir: 's', oppositeDir: 'n', axis: 'h', oppositeAxis: 'v', sign: 1 },
  w: { dir: 'w', oppositeDir: 'e', axis: 'v', oppositeAxis: 'h', sign: -1 },
  e: { dir: 'e', oppositeDir: 'w', axis: 'v', oppositeAxis: 'h', sign: 1 }
};

/**
 * Snap provider for equal distance alignment between nodes
 *
 * This provider creates "distance magnets" that allow elements to snap to positions
 * that maintain equal spacing between existing nodes. For example, if there are two
 * nodes with a 50px gap between them, this provider creates magnets that allow a
 * third node to snap to positions that create another 50px gap.
 *
 * Key concepts:
 * - Finds pairs of existing nodes in each direction (north, south, east, west)
 * - Calculates distances between node pairs that have overlapping ranges
 * - Creates magnetic lines where new elements can snap to maintain equal distances
 * - Only considers nodes that don't intersect with the element being moved
 * - Uses range overlap detection to ensure meaningful distance relationships
 *
 * Distance measurement algorithm:
 * 1. For each direction, sort nodes by proximity to the target element
 * 2. Find pairs of nodes that have overlapping ranges on the alignment axis
 * 3. Calculate the gap distance between node pairs
 * 4. Create magnets at positions that would maintain this same distance
 *
 * Example scenarios:
 * - Nodes A and B horizontally aligned with 40px gap → creates magnets 40px from A and B
 * - Three nodes evenly spaced vertically → allows fourth node to maintain same spacing
 * - Complex layouts with multiple distance patterns → creates magnets for all valid patterns
 *
 * The magnets are positioned along lines where the element can snap to maintain
 * consistent spacing, making it easy to create evenly distributed layouts.
 */
export class NodeDistanceSnapProvider
  extends AbstractNodeSnapProvider
  implements SnapProvider<'distance'>
{
  /**
   * Generate distance magnets based on spacing between existing nodes
   *
   * This method:
   * 1. Gets viable nodes in each direction (north, south, east, west) that don't intersect the box
   * 2. For each direction, sorts nodes by distance from the box
   * 3. Finds all pairs of consecutive nodes that have overlapping ranges on the alignment axis
   * 4. Creates distance magnets at positions that would maintain equal spacing
   *
   * @param box - The element being moved/resized that needs distance-based snapping
   * @returns Array of distance magnets with embedded distance pair information
   */
  getMagnets(box: Box): Array<MagnetOfType<'distance'>> {
    // Track magnet positions to avoid duplicates
    // h: horizontal positions (for vertical magnets), v: vertical positions (for horizontal magnets)
    const magnetPositions = {
      h: new Set<number>(),
      v: new Set<number>()
    };

    // Base properties shared by all distance magnets
    const baseDistanceMagnet = {
      offset: { x: 0, y: 0 },
      type: 'distance' as const
    };

    // Get all eligible nodes categorized by direction relative to the box
    // This filters out intersecting nodes and organizes remaining nodes by cardinal direction
    const viableNodes = this.getViableNodes(box);

    // Sort nodes in each direction by proximity to the box for optimal distance pattern detection
    // The sorting ensures we examine the closest node pairs first, which typically represent
    // the most relevant spacing patterns for the user
    for (const { dir, sign, oppositeDir } of Object.values(directions)) {
      // Sort nodes by distance from the box in the current direction
      // For north: sort by bottom edge (largest y first, closest to box)
      // For south: sort by top edge (smallest y first, closest to box)
      // For west: sort by right edge (largest x first, closest to box)
      // For east: sort by left edge (smallest x first, closest to box)
      viableNodes[dir].sort(
        (a, b) =>
          sign *
          (this.getEdgePosition(a.bounds, oppositeDir) -
            this.getEdgePosition(b.bounds, oppositeDir))
      );
    }

    const magnets: Array<MagnetOfType<'distance'>> = [];

    // Process each direction (north, south, east, west) to find distance patterns
    for (const { dir, axis, sign, oppositeDir, oppositeAxis } of Object.values(directions)) {
      const nodesInDirection = viableNodes[dir];

      // Needed to keep track of the number of magnets generate for each direction
      const baseMagnetCount = magnets.length;

      // Examine pairs of nodes to find distance patterns
      for (let i = 0; i < nodesInDirection.length - 1; i++) {
        const first = nodesInDirection[i]!.bounds; // The closer node to the box

        // This is a performance optimization to only look for a capped number
        // of magnets in each direction
        if (magnets.length - baseMagnetCount > 25) break;

        const firstEdgePosition = this.getEdgePosition(first, dir);
        const firstRange = this.getRange(first, axis);

        // Collect distance measurements between the first node and all further nodes
        // This creates potential distance patterns that other elements can snap to
        const distances: Array<DistancePairWithRange> = [];
        for (let j = i + 1; j < nodesInDirection.length; j++) {
          const node = nodesInDirection[j]!;

          const nodeEdgePositionOppositeDir = this.getEdgePosition(node.bounds, oppositeDir);

          // Calculate distance between the first node's far edge and the second node's near edge
          // Example: for east direction, this is node2.left - node1.right
          const d = sign * (nodeEdgePositionOppositeDir - firstEdgePosition);

          // Skip if nodes are overlapping or touching (no meaningful distance)
          if (d <= 0) continue;

          // Get the range each node occupies on the alignment axis (perpendicular to distance measurement)
          // For horizontal distance (east/west), this is the vertical range (y to y+height)
          // For vertical distance (north/south), this is the horizontal range (x to x+width)
          const rangeB = this.getRange(node.bounds, axis);

          // Find where the ranges overlap on the alignment axis
          // Only nodes with overlapping ranges can create meaningful distance relationships
          const intersection = Range.intersection(firstRange, rangeB);

          // Skip if nodes don't overlap on alignment axis (can't create meaningful distance magnet)
          if (!intersection) continue;

          // Use the midpoint of the overlapping range for positioning the distance magnet
          // This ensures the magnet line is drawn where the alignment is most visually meaningful
          const intersectionMidpoint = Range.midpoint(intersection);

          // Record the distance measurement with the points that define it
          distances.push({
            distance: d,
            // Point A: edge of the first (closer) node
            pointA: {
              x: axis === 'h' ? intersectionMidpoint : firstEdgePosition,
              y: axis === 'v' ? intersectionMidpoint : firstEdgePosition
            },
            // Point B: edge of the second (farther) node
            pointB: {
              x: axis === 'h' ? intersectionMidpoint : nodeEdgePositionOppositeDir,
              y: axis === 'v' ? intersectionMidpoint : nodeEdgePositionOppositeDir
            },
            rangeA: firstRange,
            rangeB
          });
        }

        const firstPositionOppositeDir = this.getEdgePosition(first, oppositeDir);

        // Create distance magnets for each measured distance
        for (const dp of distances) {
          // Calculate where to place the magnet: same distance away from the first node
          // as the distance between the first and second node
          const pos = firstPositionOppositeDir - sign * dp.distance;

          // Skip if we already have a magnet at this position
          if (magnetPositions[oppositeAxis].has(pos)) continue;

          // Find where the magnet line should span: intersection of first node's range and box's range
          const intersection = Range.intersection(firstRange, this.getRange(box, axis))!;

          // Create the distance magnet
          magnets.push({
            ...baseDistanceMagnet,
            line:
              axis === 'v' ? Line.vertical(pos, intersection) : Line.horizontal(pos, intersection),
            axis,
            matchDirection: dir,
            respectDirection: true,
            distancePairs: [dp]
          });

          // Mark this position as used to prevent duplicate magnets
          magnetPositions[oppositeAxis].add(pos);
        }
      }
    }

    return magnets;
  }

  /**
   * Create a highlight visualization for distance-based snapping
   *
   * When an element snaps to a distance magnet, this creates visual guides showing:
   * 1. The original distance between existing nodes (from distancePairs)
   * 2. The new equal distance created by the snapped element
   *
   * The highlight updates the distance pairs to show the actual visual connections,
   * adjusting point positions to align with the intersection of overlapping ranges.
   *
   * @param box - The box that snapped to the distance magnet
   * @param match - The matching magnet pair containing distance information
   * @param axis - The axis along which the distance alignment occurs
   * @returns Highlight with updated distance pair visualization, or undefined if no valid intersection
   */
  highlight(box: Box, match: MatchingMagnetPair<'distance'>, axis: Axis): Highlight | undefined {
    const m = match.matching; // The distance magnet that was matched

    // Get the midpoint of the snapped element's magnet line
    const tp = Line.midpoint(match.self.line);

    // Find the intersection of:
    // 1. The overlapping range of the original two nodes (rangeA ∩ rangeB)
    // 2. The range of the newly snapped box
    // This determines where the distance guides should be drawn
    const intersection = Range.intersection(
      Range.intersection(m.distancePairs[0]!.rangeA, m.distancePairs[0]!.rangeB)!,
      this.getRange(box, axis)
    );

    // If there's no intersection, we can't draw meaningful distance guides
    if (!intersection) return undefined;

    // Use the midpoint of the intersection for positioning the distance guide lines
    const mp = Range.midpoint(intersection);

    // Add a new distance pair showing the equal distance from the snapped element
    // to the original node pattern. This visualizes the new equal spacing created.
    m.distancePairs.push({
      distance: m.distancePairs[0]!.distance, // Same distance as the original pair
      pointA: Point.add(tp, {
        // Calculate the point that's the same distance away from the snapped element
        x: axis === 'v' ? directions[m.matchDirection!].sign * m.distancePairs[0]!.distance : 0,
        y: axis === 'h' ? directions[m.matchDirection!].sign * m.distancePairs[0]!.distance : 0
      }),
      pointB: tp, // The snapped element's position
      rangeA: intersection,
      rangeB: intersection
    });

    // Update all distance pairs to use the intersection midpoint for visual alignment
    // This ensures all distance highlights are drawn at the same position along the alignment axis
    for (const dp of m.distancePairs) {
      dp.pointA = {
        x: axis === 'h' ? mp : dp.pointA.x, // Use midpoint for horizontal alignment
        y: axis === 'v' ? mp : dp.pointA.y // Use midpoint for vertical alignment
      };
      dp.pointB = {
        x: axis === 'h' ? mp : dp.pointB.x, // Use midpoint for horizontal alignment
        y: axis === 'v' ? mp : dp.pointB.y // Use midpoint for vertical alignment
      };
    }

    // Return the highlight with the updated distance pairs embedded in the matching magnet
    return {
      line: match.self.line,
      matchingMagnet: match.matching, // Contains the updated distancePairs for visualization
      selfMagnet: match.self
    };
  }

  /**
   * Filter/consolidate distance highlights
   *
   * Distance highlights don't need special filtering or consolidation,
   * as each distance magnet represents a unique spacing relationship.
   */
  filterHighlights(guides: Highlight[]): Highlight[] {
    return guides;
  }
}
