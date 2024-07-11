import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from './diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { Range } from '@diagram-craft/geometry/range';

export type Anchor = {
  id: string;
  type: 'center' | 'point' | 'edge' | 'custom';

  /**
   * Position defined in a 0-1/0-1/SE coordinate system
   */
  start: Point;

  // TODO: end is not yet used
  end?: Point;

  // TODO: directions is not yet used
  /**
   * If this anchor is directional, this is the list of directions it supports
   */
  directions?: ReadonlyArray<Range>;

  // TODO: Not yet used
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
    const d = Point.squareDistance(coord, pos);
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

export const getAnchorPosition = (node: DiagramNode, anchor: Anchor): Point => {
  return Point.rotateAround(
    {
      x: node.bounds.x + anchor.start.x * node.bounds.w,
      y: node.bounds.y + anchor.start.y * node.bounds.h
    },
    node.bounds.r,
    Box.center(node.bounds)
  );
};
