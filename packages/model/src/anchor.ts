import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from './diagramNode';
import { Anchor } from './types';

export const getClosestAnchor = (coord: Point, node: DiagramNode): Anchor & { idx: number } => {
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

  return { ...anchors[closestAnchor], idx: closestAnchor };
};

export const getAnchorPosition = (node: DiagramNode, anchor: Anchor): Point => {
  return {
    x: node.bounds.x + anchor.start.x * node.bounds.w,
    y: node.bounds.y + anchor.start.y * node.bounds.h
  };
};
