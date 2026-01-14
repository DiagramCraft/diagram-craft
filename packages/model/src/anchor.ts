/**
 * Anchor system for defining and managing edge connection points on diagram nodes.
 *
 * This module provides the core functionality for creating, positioning, and finding
 * connection points (anchors) on diagram nodes. Anchors define where edges can attach
 * to nodes and how they should be oriented.
 *
 * @module anchor
 *
 * @remarks
 * ## Key Concepts
 *
 * **Normalized Coordinates**: Anchors use a normalized [0,1] coordinate system where
 * (0,0) represents the top-left corner and (1,1) represents the bottom-right corner of
 * a node's bounding box. This allows anchors to scale naturally with node resizing.
 *
 * **Anchor Types**:
 * - `center`: The node's center point, used for center-to-center connections
 * - `point`: A single connection point, typically on the node boundary
 * - `edge`: A line segment on the boundary (defined by start and end points)
 * - `custom`: User-defined anchor points
 *
 * **Normal Vectors**: Each anchor can have a normal angle (in radians) indicating the
 * preferred connection direction. This helps edges connect perpendicular to the node
 * boundary and extend outward naturally.
 *
 * **Primary Anchors**: Anchors marked as primary are highlighted in the UI for quick
 * node creation and are typically positioned at cardinal directions or significant
 * boundary points.
 *
 * ## Generation Strategies
 *
 * The {@link AnchorStrategy} namespace provides three main algorithms for automatically
 * generating anchors on nodes:
 *
 * 1. **Direction-based** ({@link AnchorStrategy.getAnchorsByDirection}):
 *    Casts rays from the center at evenly distributed angles. Best for symmetric shapes
 *    like circles, squares, and regular polygons.
 *
 * 2. **Edge-based** ({@link AnchorStrategy.getEdgeAnchors}):
 *    Places anchors on individual edge segments. Best for rectangular and polygonal
 *    shapes with distinct straight edges.
 *
 * 3. **Path-based** ({@link AnchorStrategy.getPathAnchors}):
 *    Distributes anchors evenly along the total perimeter. Best for curved or irregular
 *    shapes where uniform perimeter spacing is desired.
 *
 * ## Boundary Connections
 *
 * In addition to defined anchors, nodes can support boundary connections through
 * {@link getClosestAnchor}, which allows edges to connect at any point on the node's
 * bounding path. This is useful for freeform connections on complex shapes.
 *
 * @example
 * ```typescript
 * // Find where to connect an edge near a click point
 * const connectionPoint = getClosestAnchor(
 *   clickPosition,
 *   targetNode,
 *   true  // Include boundary as connection option
 * );
 *
 * // Generate 4 cardinal direction anchors (N, E, S, W)
 * const anchors = AnchorStrategy.getAnchorsByDirection(
 *   node,
 *   node.getDefinition().getBoundingPath(node),
 *   4
 * );
 *
 * // Convert anchor to absolute coordinates for rendering
 * const absolutePos = getAnchorPosition(node, anchors[0]);
 * ```
 *
 * @see {@link Anchor} - The core anchor type definition
 * @see {@link AnchorStrategy} - Anchor generation algorithms
 * @see {@link getClosestAnchor} - Finding connection points
 * @see {@link getAnchorPosition} - Converting to absolute coordinates
 */

import { Point } from '@diagram-craft/geometry/point';
import type { DiagramNode } from './diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { Range } from '@diagram-craft/geometry/range';
import { Line } from '@diagram-craft/geometry/line';
import { Vector } from '@diagram-craft/geometry/vector';
import { Path } from '@diagram-craft/geometry/path';
import { PointOnPath } from '@diagram-craft/geometry/pathPosition';
import { round } from '@diagram-craft/utils/math';
import { PathList } from '@diagram-craft/geometry/pathList';
import { Angle } from '@diagram-craft/geometry/angle';

/**
 * An attachment point on a node where edges can connect.
 *
 * Anchors define connection points for edges on diagram nodes. They use a normalized
 * coordinate system where [0,0] represents the top-left corner and [1,1] represents
 * the bottom-right corner of the node's bounding box.
 *
 * @remarks
 * Different anchor types serve different purposes:
 * - `center`: Always positioned at the node center (0.5, 0.5)
 * - `point`: A single connection point on the node boundary
 * - `edge`: A line segment on the node boundary (requires both start and end)
 * - `custom`: User-defined anchor points
 *
 * @example
 * ```typescript
 * const topCenterAnchor: Anchor = {
 *   id: 'top',
 *   type: 'point',
 *   start: { x: 0.5, y: 0 },
 *   normal: -Math.PI / 2,  // Points upward
 *   isPrimary: true,
 *   clip: false
 * };
 * ```
 */
export type Anchor = {
  /** Unique identifier for this anchor */
  id: string;

  /** Type of anchor determining how it behaves */
  type: 'center' | 'point' | 'edge' | 'custom';

  /** Position in normalized [0,1] coordinate system relative to node bounds */
  start: Point;

  /**
   * End position for edge-type anchors in normalized coordinates.
   * Only used when type is 'edge' to define a line segment.
   */
  end?: Point;

  // TODO: directions is not yet used
  /**
   * Supported directions for directional anchors as angle ranges in radians.
   * Restricts which directions edges can connect from.
   */
  directions?: ReadonlyArray<Range>;

  /**
   * Normal angle in radians indicating the preferred connection direction.
   * Used to orient edges perpendicular to the node boundary at this anchor.
   */
  normal?: number;

  /**
   * Whether this anchor should be highlighted for quick node creation.
   * Primary anchors are shown prominently in the UI when hovering near a node.
   */
  isPrimary?: boolean;

  /**
   * Whether connected edges should be clipped at the node boundary.
   * When true, edges stop at the anchor; when false, they extend to the boundary.
   */
  clip?: boolean;
};

/**
 * Represents a connection point, either an anchor or a boundary point.
 *
 * This type is returned by {@link getClosestAnchor} and can represent either:
 * - A defined anchor point on the node (with both anchor and point fields)
 * - A boundary connection point (with only the point field)
 *
 * @remarks
 * For edge-type anchors, the point field indicates the exact location on the edge
 * line segment where the connection should be made, calculated by projecting the
 * target coordinate onto the edge.
 */
export type AnchorPoint = {
  /**
   * The anchor definition if this connection point corresponds to a node anchor.
   * Undefined if this is a boundary connection point.
   */
  anchor?: Anchor;

  /** The absolute coordinate of the connection point in diagram space */
  point: Point;
};

/**
 * Finds the closest anchor or boundary point to a given coordinate.
 *
 * Searches through all anchors on the node and optionally the node boundary to find
 * the connection point nearest to the specified coordinate. For edge-type anchors,
 * the distance is calculated by projecting the coordinate onto the edge line segment.
 *
 * @param coord - The target coordinate in absolute diagram space
 * @param node - The diagram node to search for connection points
 * @param includeBoundary - Whether to consider the node boundary as a potential
 *   connection point. Only applies if the node definition supports 'connect-to-boundary'.
 *
 * @returns An {@link AnchorPoint} representing the closest connection point, or
 *   undefined if the node has no anchors and boundary connections are not enabled.
 *
 * @remarks
 * When `includeBoundary` is true, boundary points are preferred only if they are
 * significantly closer than the nearest anchor (5px threshold). This prevents
 * boundary connections from overshadowing intentionally placed anchors.
 *
 * @example
 * ```typescript
 * const clickPoint = { x: 100, y: 200 };
 * const closest = getClosestAnchor(clickPoint, node, true);
 * if (closest) {
 *   console.log(`Connect at ${closest.point.x}, ${closest.point.y}`);
 *   console.log(`Using anchor: ${closest.anchor?.id ?? 'boundary'}`);
 * }
 * ```
 */
export const getClosestAnchor = (
  coord: Point,
  node: DiagramNode,
  includeBoundary: boolean
): AnchorPoint | undefined => {
  let closestAnchor: Anchor | undefined;
  let closestDistance = Number.MAX_SAFE_INTEGER;

  // Find closest anchor
  for (const anchor of node.anchors) {
    const pos = getAnchorPosition(node, anchor);

    let d: number;
    if (anchor.type === 'edge') {
      // For edge anchors, project the point onto the edge line
      const end = getAnchorPosition(node, anchor, 'end');
      d = Point.squareDistance(coord, Line.projectPoint(Line.of(pos, end), coord));
    } else {
      d = Point.squareDistance(coord, pos);
    }

    if (d < closestDistance) {
      closestAnchor = anchor;
      closestDistance = d;
    }
  }

  // Check if boundary point is closer (with 5px preference threshold)
  if (includeBoundary && node.getDefinition().supports('connect-to-boundary')) {
    let closestPoint: Point | undefined;
    let closestPointDistance = Number.MAX_SAFE_INTEGER;

    for (const path of node.getDefinition().getBoundingPath(node).all()) {
      const pp = path.projectPoint(coord).point;
      const d = Point.squareDistance(coord, pp);
      if (d < closestPointDistance) {
        closestPoint = pp;
        closestPointDistance = d;
      }
    }

    // Prefer boundary if significantly closer (5px² threshold)
    if (closestPoint && closestPointDistance < closestDistance - 5 * 5) {
      return { point: closestPoint };
    }
  }

  if (closestAnchor === undefined) return undefined;

  return {
    anchor: closestAnchor,
    point: getAnchorPosition(node, closestAnchor)
  };
};

/**
 * Converts an anchor's normalized position to absolute diagram coordinates.
 *
 * Transforms the anchor's normalized [0,1] coordinates to absolute diagram space
 * coordinates, accounting for the node's bounds, position, and rotation.
 *
 * @param node - The diagram node containing the anchor
 * @param anchor - The anchor whose position to convert
 * @param key - Which position to convert: 'start' for the anchor start point,
 *   or 'end' for edge-type anchors
 *
 * @returns The absolute coordinate of the anchor position in diagram space
 *
 * @remarks
 * For edge-type anchors, use `key: 'end'` to get the end point of the edge segment.
 * For all other anchor types, only the 'start' position is meaningful.
 */
export const getAnchorPosition = (
  node: DiagramNode,
  anchor: Anchor,
  key: 'start' | 'end' = 'start'
) => node._getPositionInBounds(anchor[key]!);

/**
 * Direction of path traversal used for determining anchor normal vectors.
 *
 * Specifies how to orient normal vectors when generating anchors along a path:
 * - `clockwise`: Normals point inward (appropriate for clockwise-wound paths)
 * - `counter-clockwise`: Normals point outward (appropriate for counter-clockwise paths)
 * - `unknown`: Automatically determine direction to ensure normals point outward from node center
 *
 * @remarks
 * The winding direction of a path affects which direction is considered "outward" from
 * the shape. Using 'unknown' is safer when the path winding is uncertain, as it will
 * compute the correct orientation based on the node center.
 */
export type BoundaryDirection = 'clockwise' | 'counter-clockwise' | 'unknown';

/**
 * Strategies for generating anchors on nodes based on their shape.
 *
 * Provides different algorithms for automatically creating connection points on nodes.
 * Each strategy is appropriate for different node shapes and use cases.
 *
 * @namespace AnchorStrategy
 *
 * @example
 * ```typescript
 * // Generate 8 directional anchors (N, NE, E, SE, S, SW, W, NW)
 * const anchors = AnchorStrategy.getAnchorsByDirection(node, paths, 8);
 *
 * // Generate 3 evenly-spaced anchors per edge
 * const edgeAnchors = AnchorStrategy.getEdgeAnchors(node, paths, 3);
 *
 * // Generate 4 anchors distributed along the entire path
 * const pathAnchors = AnchorStrategy.getPathAnchors(node, paths, 4);
 * ```
 */
export const AnchorStrategy = {
  /**
   * Creates anchors by casting rays from the node center at evenly distributed angles.
   *
   * Projects rays from the center outward at equal angular intervals and places anchors
   * where these rays intersect the node boundary. Cardinal direction anchors (N, E, S, W)
   * are automatically marked as primary.
   *
   * @param node - The diagram node to generate anchors for
   * @param paths - The boundary paths of the node shape
   * @param numberOfDirections - Number of rays to cast (e.g., 4 for N/E/S/W, 8 for diagonals)
   *
   * @returns Array of anchors including a center anchor plus one per ray-boundary intersection
   *
   * @remarks
   * This strategy works well for symmetric shapes (circles, squares, regular polygons).
   * The node's rotation is accounted for when determining anchor positions and normals.
   * Ideal when you want evenly distributed anchors around a shape's perimeter.
   *
   * @example
   * ```typescript
   * // Create anchors at cardinal directions (N, E, S, W)
   * const cardinalAnchors = AnchorStrategy.getAnchorsByDirection(node, paths, 4);
   *
   * // Create anchors at 45-degree intervals (8 directions)
   * const octagonalAnchors = AnchorStrategy.getAnchorsByDirection(node, paths, 8);
   * ```
   */
  getAnchorsByDirection: (node: DiagramNode, paths: PathList, numberOfDirections: number) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    const firstPath = paths.all()[0]!;
    const center = Box.center(node.bounds);
    const maxD = Math.max(node.bounds.w, node.bounds.h);

    // Cast rays at evenly distributed angles, accounting for node rotation
    for (let d = 0; d < 2 * Math.PI; d += (2 * Math.PI) / numberOfDirections) {
      const l = Line.of(center, Point.add(center, Vector.fromPolar(d + node.bounds.r, maxD)));
      const linePath = new Path(center, [['L', l.to.x, l.to.y]]);

      // Find where each ray intersects the shape boundary
      firstPath.intersections(linePath).forEach(p => {
        const lengthOffsetOnPath = PointOnPath.toTimeOffset(p, firstPath);
        const start = toNormalizedCoords(p.point, node.bounds);

        newAnchors.push({
          id: makeAnchorId(start),
          start: start,
          clip: false,
          type: 'point',
          normal:
            Vector.angle(Vector.tangentToNormal(firstPath.tangentAt(lengthOffsetOnPath))) -
            node.bounds.r +
            Math.PI,
          isPrimary: Angle.isCardinal(d)
        });
      });
    }

    return newAnchors;
  },

  /**
   * Creates evenly spaced anchors along each edge segment of the node boundary.
   *
   * Places anchors at regular intervals on each individual edge (line segment) of the
   * node's boundary path. Short edges are automatically skipped to avoid cluttering
   * small segments with anchors.
   *
   * @param node - The diagram node to generate anchors for
   * @param paths - The boundary paths of the node shape
   * @param numberPerEdge - Number of anchors to place on each edge segment (default: 1)
   * @param direction - Winding direction for computing outward-facing normals (default: 'unknown')
   *
   * @returns Array of anchors including a center anchor plus anchors on each edge segment
   *
   * @remarks
   * - Edges that are too short are skipped
   * - Anchors are evenly distributed as fractions along each edge (e.g., 0.33, 0.5, 0.67 for 3 anchors)
   * - The middle anchor on significant edges (>25% of max dimension) is marked as primary
   * - Returns only a center anchor if the node has zero width or height
   *
   * @example
   * ```typescript
   * // Place one anchor at the midpoint of each edge
   * const midpoints = AnchorStrategy.getEdgeAnchors(node, paths, 1);
   *
   * // Place 3 evenly spaced anchors on each edge
   * const multiAnchors = AnchorStrategy.getEdgeAnchors(node, paths, 3);
   *
   * // Use with known clockwise winding
   * const clockwiseAnchors = AnchorStrategy.getEdgeAnchors(
   *   node, paths, 2, 'clockwise'
   * );
   * ```
   */
  getEdgeAnchors: (
    node: DiagramNode,
    paths: PathList,
    numberPerEdge = 1,
    direction: BoundaryDirection = 'unknown'
  ) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    const d = 1 / (numberPerEdge + 1);
    const minLength = Math.min(node.bounds.w, node.bounds.h) / 20;

    if (node.bounds.h === 0 || node.bounds.w === 0) return newAnchors;

    for (const path of paths.all()) {
      for (let j = 0; j < path.segments.length; j++) {
        const p = path.segments[j]!;
        // Skip edges that are too short
        if (p.length() < minLength) continue;

        for (let n = 0; n < numberPerEdge; n++) {
          const pct = (n + 1) * d;
          const { x, y } = p.point(pct);

          const point = Point.of(x, y);
          const normalizedStart = toNormalizedCoords(point, node.bounds);
          const rotatedPoint = Point.rotateAround(point, -node.bounds.r, Box.center(node.bounds));

          const normal = adjustNormalDirection(
            Vector.angle(Vector.tangentToNormal(p.tangent(pct))) - node.bounds.r,
            direction,
            node.bounds,
            rotatedPoint
          );

          newAnchors.push({
            id: makeAnchorId(normalizedStart),
            start: normalizedStart,
            clip: false,
            type: 'point',
            normal: normal,
            // Mark middle anchor as primary if the edge is significant in size
            isPrimary:
              p.length() / Math.max(node.bounds.w, node.bounds.h) > 0.25 && round(pct) === 0.5
          });
        }
      }
    }

    return newAnchors;
  },

  /**
   * Creates evenly distributed anchors along entire path perimeters.
   *
   * Unlike {@link getEdgeAnchors} which distributes anchors per individual edge segment,
   * this strategy distributes anchors evenly along the total length of each path. This
   * produces more uniform spacing on complex curved shapes.
   *
   * @param node - The diagram node to generate anchors for
   * @param paths - The boundary paths of the node shape
   * @param numberPerPath - Number of anchors to place along each complete path (default: 1)
   * @param direction - Winding direction for computing outward-facing normals (default: 'unknown')
   *
   * @returns Array of anchors including a center anchor plus evenly distributed path anchors
   *
   * @remarks
   * - All generated anchors are marked as primary
   * - Returns only a center anchor if the node has zero width or height
   *
   * @example
   * ```typescript
   * // Place one anchor at the start of the path
   * const singleAnchor = AnchorStrategy.getPathAnchors(node, paths, 1);
   *
   * // Place 5 evenly spaced anchors around the entire perimeter
   * const perimeterAnchors = AnchorStrategy.getPathAnchors(node, paths, 5);
   *
   * // Great for circles or ellipses
   * const circleAnchors = AnchorStrategy.getPathAnchors(circleNode, circlePaths, 8);
   * ```
   */
  getPathAnchors: (
    node: DiagramNode,
    paths: PathList,
    numberPerPath = 1,
    direction: BoundaryDirection = 'unknown'
  ) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    // Special case: single anchor goes at the start (0/0 would be division by zero)
    const d = numberPerPath === 1 ? 0 : 1 / (numberPerPath - 1);

    if (node.bounds.h === 0 || node.bounds.w === 0) return newAnchors;

    for (const path of paths.all()) {
      const length = path.length();
      for (let n = 0; n < numberPerPath; n++) {
        // Cap at 0.999 to avoid edge cases at path end
        const pct = Math.min(0.999, n * d);
        const point = path.pointAt({ pathD: pct * length });

        const normalizedStart = toNormalizedCoords(point, node.bounds);
        const rotatedPoint = Point.rotateAround(point, -node.bounds.r, Box.center(node.bounds));

        const normal = adjustNormalDirection(
          Vector.angle(Vector.tangentToNormal(path.tangentAt({ pathD: pct * length }))) -
            node.bounds.r,
          direction,
          node.bounds,
          rotatedPoint
        );

        newAnchors.push({
          id: makeAnchorId(normalizedStart),
          start: normalizedStart,
          clip: false,
          type: 'point',
          normal: normal,
          isPrimary: true
        });
      }
    }

    return newAnchors;
  }
};

/**
 * Generates a unique ID for an anchor based on its normalized position.
 */
const makeAnchorId = (p: Point) => `${Math.round(p.x * 1000)}_${Math.round(p.y * 1000)}`;

/**
 * Creates the center anchor that all anchor generation strategies include.
 */
const centerAnchor = (): Anchor => ({
  id: 'c',
  start: Point.of(0.5, 0.5),
  clip: true,
  type: 'center'
});

/**
 * Converts a point from absolute diagram coordinates to normalized [0,1] coordinates.
 */
const toNormalizedCoords = (point: Point, bounds: Box): Point => {
  const rotated = Point.rotateAround(point, -bounds.r, Box.center(bounds));
  return Point.of(
    round((rotated.x - bounds.x) / bounds.w),
    round((rotated.y - bounds.y) / bounds.h)
  );
};

/**
 * Adjusts an anchor's normal vector based on the boundary path winding direction.
 *
 * Ensures that anchor normals point in the correct direction (typically outward from
 * the node) based on how the boundary path is wound.
 */
const adjustNormalDirection = (
  baseNormal: number,
  direction: BoundaryDirection,
  bounds: Box,
  point: Point
): number => {
  let normal = baseNormal;

  if (direction === 'unknown') {
    // Check if normal points inward by testing dot product with vector from center
    const tangent = Vector.from(Box.center(bounds), point);
    if (Vector.dotProduct(tangent, Vector.fromPolar(normal, 1)) < 0) {
      normal += Math.PI; // Flip to point outward
    }
  } else if (direction === 'clockwise') {
    normal += Math.PI;
  }

  return normal;
};

/** @internal */
export const _test = {
  toNormalizedCoords,
  adjustNormalDirection,
  makeAnchorId
};
