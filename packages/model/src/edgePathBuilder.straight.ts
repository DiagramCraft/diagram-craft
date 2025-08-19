import type { DiagramEdge } from './diagramEdge';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';

export const buildStraightEdgePath = (edge: DiagramEdge) => {
  const path = new PathListBuilder();

  path.moveTo(edge.start.position);
  edge.waypoints.forEach(wp => {
    path.lineTo(wp.point);
  });
  path.lineTo(edge.end.position);

  return path.getPaths().singular();
};
