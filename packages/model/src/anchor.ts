import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from './diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { Range } from '@diagram-craft/geometry/range';
import { Line } from '@diagram-craft/geometry/line';
import { CompoundPath } from '@diagram-craft/geometry/pathBuilder';
import { Vector } from '@diagram-craft/geometry/vector';
import { Path } from '@diagram-craft/geometry/path';
import { PointOnPath } from '@diagram-craft/geometry/pathPosition';
import { round } from '@diagram-craft/utils/math';

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
   * If true, edges connected to this anchor will clipped at the boundary
   * of the node
   */
  clip?: boolean;
};

// This represents a endpoint connection. In most cases it's an anchor, but in
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
  const anchors = node.anchors;

  let closestAnchor = -1;
  let closestDistance = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const pos = getAnchorPosition(node, a);

    let d = Point.squareDistance(coord, pos);

    if (a.type === 'edge') {
      const end = getAnchorPosition(node, a, 'end');
      const p = Line.projectPoint(Line.of(pos, end), coord);
      d = Point.squareDistance(coord, p);
    }

    if (d < closestDistance) {
      closestAnchor = i;
      closestDistance = d;
    }
  }

  if (includeBoundary && node.getDefinition().supports('connect-to-boundary')) {
    const boundingPath = node.getDefinition().getBoundingPath(node);
    let closestPoint: Point | undefined = undefined;
    let closestPointDistance = Number.MAX_SAFE_INTEGER;
    for (const path of boundingPath.all()) {
      const pp = path.projectPoint(coord).point;
      const d = Point.squareDistance(coord, pp);
      if (d < closestPointDistance) {
        closestPoint = pp;
        closestPointDistance = d;
      }
    }

    if (closestPoint && closestPointDistance < closestDistance - 25) {
      return {
        point: closestPoint
      };
    }
  }

  if (closestAnchor === -1) return undefined;

  return { anchor: anchors[closestAnchor], point: getAnchorPosition(node, anchors[closestAnchor]) };
};

export const getAnchorPosition = (
  node: DiagramNode,
  anchor: Anchor,
  key: 'start' | 'end' = 'start'
): Point => {
  return Point.rotateAround(
    {
      x: node.bounds.x + anchor[key]!.x * node.bounds.w,
      y: node.bounds.y + anchor[key]!.y * node.bounds.h
    },
    node.bounds.r,
    Box.center(node.bounds)
  );
};

export type BoundaryDirection = 'clockwise' | 'counter-clockwise' | 'unknown';

export const makeAnchorId = (p: Point) => {
  return `${Math.round(p.x * 1000)}_${Math.round(p.y * 1000)}`;
};

export const AnchorStrategy = {
  getAnchorsByDirection: (node: DiagramNode, paths: CompoundPath, numberOfDirections: number) => {
    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ id: 'c', start: { x: 0.5, y: 0.5 }, clip: true, type: 'center' });

    const center = Box.center(node.bounds);
    const maxD = Math.max(node.bounds.w, node.bounds.h);
    for (let d = 0; d < 2 * Math.PI; d += (2 * Math.PI) / numberOfDirections) {
      const l = Line.of(center, Point.add(center, Vector.fromPolar(d + node.bounds.r, maxD)));
      const linePath = new Path(center, [['L', l.to.x, l.to.y]]);
      const firstPath = paths.all()[0];
      firstPath.intersections(linePath).forEach(p => {
        const lengthOffsetOnPath = PointOnPath.toTimeOffset(p, firstPath);

        // Need to rotate back to get anchors in the [0,1],[0,1] coordinate system
        const point = Point.rotateAround(p.point, -node.bounds.r, Box.center(node.bounds));

        const start = {
          x: (point.x - node.bounds.x) / node.bounds.w,
          y: (point.y - node.bounds.y) / node.bounds.h
        };
        newAnchors.push({
          id: makeAnchorId(start),
          start: start,
          clip: false,
          type: 'point',
          normal:
            Vector.angle(Vector.tangentToNormal(firstPath.tangentAt(lengthOffsetOnPath))) -
            node.bounds.r +
            Math.PI,
          isPrimary:
            round(d) === 0 ||
            round(d) === round(Math.PI / 2) ||
            round(d) === round(Math.PI) ||
            round(d) === round((3 * Math.PI) / 2)
        });
      });
    }

    return newAnchors;
  },
  getEdgeAnchors: (
    node: DiagramNode,
    paths: CompoundPath,
    numberPerEdge = 1,
    direction: BoundaryDirection = 'unknown'
  ) => {
    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ id: 'c', start: { x: 0.5, y: 0.5 }, clip: true, type: 'center' });

    const d = 1 / (numberPerEdge + 1);

    const minLength = Math.min(node.bounds.w, node.bounds.h) / 20;

    // Get anchors per side
    for (let i = 0; i < paths.all().length; i++) {
      const path = paths.all()[i];
      for (let j = 0; j < path.segments.length; j++) {
        for (let n = 0; n < numberPerEdge; n++) {
          const p = path.segments[j];
          const pct = (n + 1) * d;
          const { x, y } = p.point(pct);

          if (p.length() < minLength) continue;

          // Need to rotate back to get anchors in the [0,1],[0,1] coordinate system
          const rp = Point.rotateAround({ x, y }, -node.bounds.r, Box.center(node.bounds));

          // Note: This is to Prevent NaN issues
          if (node.bounds.h === 0 || node.bounds.w === 0) continue;

          const lx = round((rp.x - node.bounds.x) / node.bounds.w);
          const ly = round((rp.y - node.bounds.y) / node.bounds.h);

          let normal = Vector.angle(Vector.tangentToNormal(p.tangent(0.5))) - node.bounds.r;

          if (direction === 'unknown') {
            // Make sure normal is "outwards" from the center of the node
            const tangent = Vector.from(Box.center(node.bounds), rp);
            if (Vector.dotProduct(tangent, Vector.fromPolar(normal, 1)) < 0) {
              normal += Math.PI;
            }
          } else if (direction === 'clockwise') {
            normal += Math.PI;
          }

          newAnchors.push({
            id: makeAnchorId({ x: lx, y: ly }),
            start: { x: lx, y: ly },
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
  }
};
