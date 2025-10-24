import type { ControlPoints, DiagramEdge } from './diagramEdge';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';

export const buildBezierEdgePath = (edge: DiagramEdge) => {
  const path = new PathListBuilder();

  path.moveTo(edge.start.position);
  if (edge.waypoints.length === 0) {
    path.lineTo(edge.end.position);
  } else {
    const controlPoints: ControlPoints[] = [];

    // Ensure all control points exists, as they may not in case the edge type has been changed
    for (let i = 0; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i]!;
      if (wp.controlPoints) {
        controlPoints.push(wp.controlPoints);
      } else {
        controlPoints.push(edge.inferControlPoints(i));
      }
    }

    const fp = edge.waypoints[0]!;
    path.quadTo(fp.point, Point.add(controlPoints[0]!.cp1, fp.point));
    for (let i = 1; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i]!;
      const pwp = edge.waypoints[i - 1]!;
      path.cubicTo(
        wp.point,
        Point.add(controlPoints[i - 1]!.cp2, pwp.point),
        Point.add(controlPoints[i]!.cp1, wp.point)
      );
    }

    const last = edge.waypoints.at(-1)!;
    path.quadTo(edge.end.position, Point.add(controlPoints.at(-1)!.cp2, last.point));
  }

  return path.getPaths().singular();
};
