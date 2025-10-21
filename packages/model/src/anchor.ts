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

export type Anchor = {
  id: string;
  type: 'center' | 'point' | 'edge' | 'custom';

  /**
   * Position defined in a 0-1/0-1/SE coordinate system
   */
  start: Point;
  end?: Point;

  // TODO: directions is not yet used
  /**
   * If this anchor is directional, this is the list of directions it supports
   */
  directions?: ReadonlyArray<Range>;

  /**
   * If this anchor is directional (type point and edge are),
   * this is the normal of the anchor
   */
  normal?: number;

  /**
   * If true, this anchor can be used for creating new nodes quickly
   */
  isPrimary?: boolean;

  /**
   * If true, edges connected to this anchor will be clipped at the boundary
   * of the node
   */
  clip?: boolean;
};

// This represents an endpoint connection. In most cases it's an anchor, but in
// case you are attaching to the boundary, it's a point
//
// Also, for edge anchors, the point indicates the exact point on the edge
type AnchorPoint = {
  anchor?: Anchor;
  point: Point;
};

export const getClosestAnchor = (
  coord: Point,
  node: DiagramNode,
  includeBoundary: boolean
): AnchorPoint | undefined => {
  let closestAnchor: Anchor | undefined;
  let closestDistance = Number.MAX_SAFE_INTEGER;
  for (const anchor of node.anchors) {
    const pos = getAnchorPosition(node, anchor);

    let d: number;
    if (anchor.type === 'edge') {
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

    if (closestPoint && closestPointDistance < closestDistance - 5 * 5) {
      return {
        point: closestPoint
      };
    }
  }

  if (closestAnchor === undefined) return undefined;

  return {
    anchor: closestAnchor,
    point: getAnchorPosition(node, closestAnchor)
  };
};

export const getAnchorPosition = (
  node: DiagramNode,
  anchor: Anchor,
  key: 'start' | 'end' = 'start'
) => node._getPositionInBounds(anchor[key]!);

export type BoundaryDirection = 'clockwise' | 'counter-clockwise' | 'unknown';

export const makeAnchorId = (p: Point) => `${Math.round(p.x * 1000)}_${Math.round(p.y * 1000)}`;

const centerAnchor = (): Anchor => ({
  id: 'c',
  start: Point.of(0.5, 0.5),
  clip: true,
  type: 'center'
});

/**
 * Converts a point from absolute coordinates to normalized [0,1] coordinates
 * relative to the node bounds, accounting for rotation.
 */
const toNormalizedCoords = (point: Point, bounds: Box): Point => {
  const rotated = Point.rotateAround(point, -bounds.r, Box.center(bounds));
  return Point.of(
    round((rotated.x - bounds.x) / bounds.w),
    round((rotated.y - bounds.y) / bounds.h)
  );
};

/**
 * Adjusts the normal vector based on the boundary direction.
 * For 'unknown' direction, ensures the normal points outward from the node center.
 */
const adjustNormalDirection = (
  baseNormal: number,
  direction: BoundaryDirection,
  bounds: Box,
  point: Point
): number => {
  let normal = baseNormal;

  if (direction === 'unknown') {
    // Make sure normal is "outwards" from the center of the node
    const tangent = Vector.from(Box.center(bounds), point);
    if (Vector.dotProduct(tangent, Vector.fromPolar(normal, 1)) < 0) {
      normal += Math.PI;
    }
  } else if (direction === 'clockwise') {
    normal += Math.PI;
  }

  return normal;
};

export const AnchorStrategy = {
  getAnchorsByDirection: (node: DiagramNode, paths: PathList, numberOfDirections: number) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    const firstPath = paths.all()[0]!;

    const center = Box.center(node.bounds);
    const maxD = Math.max(node.bounds.w, node.bounds.h);
    for (let d = 0; d < 2 * Math.PI; d += (2 * Math.PI) / numberOfDirections) {
      const l = Line.of(center, Point.add(center, Vector.fromPolar(d + node.bounds.r, maxD)));
      const linePath = new Path(center, [['L', l.to.x, l.to.y]]);
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
  getEdgeAnchors: (
    node: DiagramNode,
    paths: PathList,
    numberPerEdge = 1,
    direction: BoundaryDirection = 'unknown'
  ) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    const d = 1 / (numberPerEdge + 1);
    const minLength = Math.min(node.bounds.w, node.bounds.h) / 20;

    // Note: This is to prevent NaN issues
    if (node.bounds.h === 0 || node.bounds.w === 0) return newAnchors;

    // Get anchors per side
    for (const path of paths.all()) {
      for (let j = 0; j < path.segments.length; j++) {
        const p = path.segments[j]!;
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
            isPrimary:
              p.length() / Math.max(node.bounds.w, node.bounds.h) > 0.25 && round(pct) === 0.5
          });
        }
      }
    }

    return newAnchors;
  },
  getPathAnchors: (
    node: DiagramNode,
    paths: PathList,
    numberPerPath = 1,
    direction: BoundaryDirection = 'unknown'
  ) => {
    const newAnchors: Array<Anchor> = [centerAnchor()];

    const d = numberPerPath === 1 ? 0 : 1 / (numberPerPath - 1);

    // Note: This is to Prevent NaN issues
    if (node.bounds.h === 0 || node.bounds.w === 0) return newAnchors;

    // Get anchors per side
    for (const path of paths.all()) {
      const length = path.length();
      for (let n = 0; n < numberPerPath; n++) {
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

export const _test = {
  toNormalizedCoords,
  adjustNormalDirection
};
