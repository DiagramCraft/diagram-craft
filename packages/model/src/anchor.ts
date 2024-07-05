import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from './diagramNode';

export type Anchor = {
  id: string;
  type: 'center' | 'point' | 'edge' | 'custom';
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

export const getClosestAnchor = (coord: Point, node: DiagramNode): Anchor => {
  const anchors = node.anchors;

  let closestAnchor = 0;
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

  return anchors[closestAnchor];
};

export const getAnchorPosition = (node: DiagramNode, anchor: Anchor): Point => {
  return {
    x: node.bounds.x + anchor.start.x * node.bounds.w,
    y: node.bounds.y + anchor.start.y * node.bounds.h
  };
};
