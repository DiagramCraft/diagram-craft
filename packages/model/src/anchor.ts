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
 */
export type Anchor = {
  id: string;
  type: 'center' | 'point' | 'edge' | 'custom';

  /** Position in normalized [0,1] coordinate system */
  start: Point;

  /** End position for edge-type anchors */
  end?: Point;

  // TODO: directions is not yet used
  /** Supported directions for directional anchors */
  directions?: ReadonlyArray<Range>;

  /** Normal angle in radians for directional anchors */
  normal?: number;

  /** Whether this anchor should be highlighted for quick node creation */
  isPrimary?: boolean;

  /** Whether connected edges should be clipped at the node boundary */
  clip?: boolean;
};

/**
 * Represents a connection point, either an anchor or a boundary point.
 * For edge-type anchors, the point indicates the exact location on the edge.
 */
type AnchorPoint = {
  anchor?: Anchor;
  point: Point;
};

/**
 * Finds the closest anchor to a given coordinate.
 * Optionally includes the node's boundary as a potential connection point.
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
 * Converts an anchor's normalized position to absolute coordinates.
 */
export const getAnchorPosition = (
  node: DiagramNode,
  anchor: Anchor,
  key: 'start' | 'end' = 'start'
) => node._getPositionInBounds(anchor[key]!);

/** Direction of path traversal for determining normal vectors */
export type BoundaryDirection = 'clockwise' | 'counter-clockwise' | 'unknown';

/**
 * Strategies for generating anchors on nodes based on their shape.
 */
export const AnchorStrategy = {
  /**
   * Creates anchors by casting rays from the center in specified directions.
   * Cardinal directions (N, E, S, W) are marked as primary.
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
   * Creates evenly spaced anchors along each edge segment.
   * Skips edges that are too short relative to the node size.
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
   * Creates evenly distributed anchors along entire paths.
   * All path anchors are marked as primary.
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

/** Generates a unique ID for an anchor based on its normalized position */
const makeAnchorId = (p: Point) => `${Math.round(p.x * 1000)}_${Math.round(p.y * 1000)}`;

/** Creates the center anchor that all strategies include */
const centerAnchor = (): Anchor => ({
  id: 'c',
  start: Point.of(0.5, 0.5),
  clip: true,
  type: 'center'
});

/**
 * Converts a point from absolute coordinates to normalized [0,1] coordinates.
 * Accounts for node rotation by rotating the point back before normalizing.
 */
const toNormalizedCoords = (point: Point, bounds: Box): Point => {
  const rotated = Point.rotateAround(point, -bounds.r, Box.center(bounds));
  return Point.of(
    round((rotated.x - bounds.x) / bounds.w),
    round((rotated.y - bounds.y) / bounds.h)
  );
};

/**
 * Adjusts the normal vector based on boundary direction.
 * For 'unknown', ensures the normal points outward from the node center.
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
