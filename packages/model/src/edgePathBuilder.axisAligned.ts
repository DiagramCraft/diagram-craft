import type { DiagramEdge } from './diagramEdge';
import type { DiagramNode } from './diagramNode';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { ConnectedEndpoint } from './endpoint';
import { Line } from '@diagram-craft/geometry/line';
import { Path } from '@diagram-craft/geometry/path';
import { Point } from '@diagram-craft/geometry/point';
import { clamp } from '@diagram-craft/utils/math';
import { smallest } from '@diagram-craft/utils/array';

// Find the point where an infinite line (linePath) crosses the node's bounding shape,
// returning the intersection closest to `ref` (the raw endpoint position).
const findBoundaryPoint = (node: DiagramNode, linePath: Path, ref: Point): Point | undefined => {
  const pts = node.getDefinition().getBoundingPath(node).intersections(linePath);
  return smallest(pts, (a, b) => Point.distance(a, ref) - Point.distance(b, ref));
};

// Infinite horizontal / vertical scan lines used to probe node boundaries.
const hLine = (y: number) => new Path({ x: -1e6, y }, [['L', 1e6, y]]);
const vLine = (x: number) => new Path({ x, y: -1e6 }, [['L', x, 1e6]]);

/**
 * Build a straight, axis-aligned edge path.
 *
 * "Axis-aligned" means the edge exits a node horizontally or vertically —
 * i.e. both endpoints sit on the same horizontal or vertical line.  The
 * builder adjusts the raw connection-point positions so the path enters/
 * exits each node cleanly at its boundary, rather than at whatever anchor
 * the user clicked.
 *
 * The preferred axis is determined by whether the two endpoints are further
 * apart horizontally or vertically.  A single waypoint can override the
 * midpoint used to pick the scan-line position.
 */
export const buildAxisAlignedEdgePath = (edge: DiagramEdge) => {
  const path = new PathListBuilder();

  let start = edge.start.position;
  let end = edge.end.position;

  // Use an explicit waypoint as the midpoint hint; otherwise use the geometric
  // midpoint of the raw start→end segment.
  const preferredMidpoint =
    edge.waypoints.length === 1
      ? edge.waypoints[0]!.point
      : Line.midpoint(Line.of(start, end));

  // Primary axis: whichever direction spans the greater distance.
  const isHorizontal = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);

  if (
    edge.start instanceof ConnectedEndpoint &&
    edge.start.isNodeConnected() &&
    edge.end instanceof ConnectedEndpoint &&
    edge.end.isNodeConnected()
  ) {
    // Both endpoints are attached to nodes.  Try to find a shared horizontal or
    // vertical line that crosses both node boundaries.

    const startNode = edge.start.node;
    const endNode = edge.end.node;

    // Try a horizontal scan: find a Y value that lies inside both nodes' vertical
    // extents, then intersect that horizontal line with each node's boundary.
    const tryH = () => {
      const overlapYMin = Math.max(startNode.bounds.y, endNode.bounds.y);
      const overlapYMax = Math.min(
        startNode.bounds.y + startNode.bounds.h,
        endNode.bounds.y + endNode.bounds.h
      );
      if (overlapYMin > overlapYMax) return undefined; // nodes don't overlap vertically
      const targetY = clamp(preferredMidpoint.y, overlapYMin, overlapYMax);
      const newStart = findBoundaryPoint(startNode, hLine(targetY), start);
      const newEnd = findBoundaryPoint(endNode, hLine(targetY), end);
      if (newStart && newEnd) return { newStart, newEnd };
      return undefined;
    };

    // Try a vertical scan: find an X value that lies inside both nodes' horizontal
    // extents, then intersect that vertical line with each node's boundary.
    const tryV = () => {
      const overlapXMin = Math.max(startNode.bounds.x, endNode.bounds.x);
      const overlapXMax = Math.min(
        startNode.bounds.x + startNode.bounds.w,
        endNode.bounds.x + endNode.bounds.w
      );
      if (overlapXMin > overlapXMax) return undefined; // nodes don't overlap horizontally
      const targetX = clamp(preferredMidpoint.x, overlapXMin, overlapXMax);
      const newStart = findBoundaryPoint(startNode, vLine(targetX), start);
      const newEnd = findBoundaryPoint(endNode, vLine(targetX), end);
      if (newStart && newEnd) return { newStart, newEnd };
      return undefined;
    };

    // Prefer the primary axis; fall back to the other if no overlap exists.
    const result = isHorizontal ? (tryH() ?? tryV()) : (tryV() ?? tryH());
    if (result) {
      start = result.newStart;
      end = result.newEnd;
    }
  } else if (edge.start instanceof ConnectedEndpoint && edge.start.isNodeConnected()) {
    // Only the start is attached to a node; snap it to the boundary point that
    // aligns with the free end.
    const startNode = edge.start.node;

    const tryH = () => findBoundaryPoint(startNode, hLine(end.y), start);
    const tryV = () => findBoundaryPoint(startNode, vLine(end.x), start);

    const newStart = isHorizontal ? (tryH() ?? tryV()) : (tryV() ?? tryH());
    if (newStart) start = newStart;
  } else if (edge.end instanceof ConnectedEndpoint && edge.end.isNodeConnected()) {
    // Only the end is attached to a node; snap it to the boundary point that
    // aligns with the free start.
    const endNode = edge.end.node;

    const tryH = () => findBoundaryPoint(endNode, hLine(start.y), end);
    const tryV = () => findBoundaryPoint(endNode, vLine(start.x), end);

    const newEnd = isHorizontal ? (tryH() ?? tryV()) : (tryV() ?? tryH());
    if (newEnd) end = newEnd;
  }

  path.moveTo(start);
  path.lineTo(end);

  return path.getPaths().singular();
};
