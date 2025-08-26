import type { DiagramNode } from '../diagramNode';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';
import { Direction } from '@diagram-craft/geometry/direction';
import { Range } from '@diagram-craft/geometry/range';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';

/**
 * Base properties shared by all magnet types
 * A magnet represents a line that can attract other magnetic lines for snapping
 */
type BaseMagnet = {
  /** The geometric line that defines the magnet's position */
  line: Line;
  /** Whether this is a horizontal or vertical magnet */
  axis: Axis;
  /** The direction this magnet represents (n/s/e/w), if any */
  matchDirection?: Direction;
  /** Whether the magnet only matches others with the same direction */
  respectDirection?: boolean;
};

/**
 * Represents a distance measurement between two points
 * Used for equal-distance snapping between nodes
 * TODO: This is a bit redundant as the distance will be the same for all pairs
 */
export type DistancePair = {
  /** The distance between the two points */
  distance: number;
  /** First point in the distance measurement */
  pointA: Point;
  /** Second point in the distance measurement */
  pointB: Point;
};

/**
 * Distance pair with additional range information
 * Used for distance magnets that need to track the extent of elements
 */
export type DistancePairWithRange = DistancePair & {
  /** Range along the axis for the first element */
  rangeA: Range;
  /** Range along the axis for the second element */
  rangeB: Range;
};

/**
 * Union type representing all possible magnet types
 * Each magnet type serves a different snapping purpose:
 * - canvas: Canvas boundaries
 * - grid: Grid lines
 * - guide: User-defined guide lines
 * - source: Element being moved (not a target)
 * - size: Equal-size snapping between nodes
 * - node: Node edges and centers
 * - distance: Equal-distance snapping between nodes
 */
export type Magnet = BaseMagnet &
  (
    | {
        /** Simple magnets without additional data */
        type: 'canvas' | 'grid' | 'guide';
      }
    | {
        /** Source magnet belongs to the element being moved */
        type: 'source';
        /** Optional subtype (e.g. 'center' for center lines) */
        subtype?: string;
      }
    | {
        /** Size magnet for equal-size snapping */
        type: 'size';
        /** The size value this magnet represents */
        size: number;
        /** The node this magnet belongs to */
        node: DiagramNode;
        /** Distance pairs for size calculations */
        distancePairs: Array<DistancePair>;
      }
    | {
        /** Node magnet represents edges/centers of nodes */
        type: 'node';
        /** The node this magnet belongs to */
        node: DiagramNode;
      }
    | {
        /** Distance magnet for equal-distance snapping */
        type: 'distance';
        /** Distance pairs with range information */
        distancePairs: Array<DistancePairWithRange>;
      }
  );

/** Union of all possible magnet type strings */
export type MagnetType = Magnet['type'];

/** Type helper to get a magnet of a specific type */
export type MagnetOfType<T extends MagnetType> = Magnet & { type: T };

/**
 * Utility functions for working with magnets
 */
export const Magnet = {
  sourceMagnetsForNode: (node: DiagramNode): ReadonlyArray<Magnet> => {
    return Magnet.forNode(node.bounds);
  },

  /**
   * Generate magnets for a box (typically a node)
   * Creates magnets for:
   * - Horizontal and vertical center lines (always)
   * - Top, bottom, left, right edges (only for non-rotated boxes)
   *
   * @param node - The box to generate magnets for
   * @param type - The magnet type to create (typically 'source')
   * @returns Array of magnets representing the box's snap points
   */
  forNode: (node: Box, type: 'source' = 'source'): ReadonlyArray<Magnet> => {
    const magnets: Magnet[] = [
      {
        // Horizontal center line (middle of the box vertically)
        line: Line.horizontal(node.y + node.h / 2, [node.x, node.x + node.w]),
        axis: Axis.h,
        type,
        subtype: 'center'
      },
      {
        // Vertical center line (middle of the box horizontally)
        line: Line.vertical(node.x + node.w / 2, [node.y, node.y + node.h]),
        axis: Axis.v,
        type,
        subtype: 'center'
      }
    ];

    // For rotated boxes, only use center lines to avoid complex edge calculations
    if (node.r !== 0) return magnets;

    // Add edge magnets for non-rotated boxes
    magnets.push({
      // Top edge
      line: Line.of({ x: node.x, y: node.y }, { x: node.x + node.w, y: node.y }),
      axis: Axis.h,
      type,
      matchDirection: 'n'
    });
    magnets.push({
      // Bottom edge
      line: Line.of({ x: node.x, y: node.y + node.h }, { x: node.x + node.w, y: node.y + node.h }),
      axis: Axis.h,
      type,
      matchDirection: 's'
    });
    magnets.push({
      // Left edge
      line: Line.of({ x: node.x, y: node.y }, { x: node.x, y: node.y + node.h }),
      axis: Axis.v,
      type,
      matchDirection: 'w'
    });
    magnets.push({
      // Right edge
      line: Line.of({ x: node.x + node.w, y: node.y }, { x: node.x + node.w, y: node.y + node.h }),
      axis: Axis.v,
      type,
      matchDirection: 'e'
    });

    return magnets;
  }
};
