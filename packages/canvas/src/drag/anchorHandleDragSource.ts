import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import type { Path } from '@diagram-craft/geometry/path';
import { Point } from '@diagram-craft/geometry/point';
import type { LengthOffsetOnPath, TimeOffsetOnSegment } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { getAnchorPosition } from '@diagram-craft/model/anchor';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import type { Modifiers } from '../dragDropManager';

export type AnchorHandleDragSource =
  | {
      type: 'anchor';
      anchorId: string;
      normal?: number;
      point: Point;
    }
  | {
      type: 'edge-anchor';
      anchorId: string;
      offset: Point;
      normal: number;
      point: Point;
    }
  | {
      type: 'boundary-point';
      offset: Point;
      normal: number;
      point: Point;
    };

type ClosestEdgeAnchor = {
  anchorId: string;
  point: Point;
  offset: Point;
  normal: number;
  distance: number;
};

type BoundaryProjection = {
  point: Point;
  pathIdx: number;
  offset: TimeOffsetOnSegment & LengthOffsetOnPath;
};

export const projectToDynamicHandle = (
  node: DiagramNode,
  point: Point,
  modifiers: Modifiers
): AnchorHandleDragSource | undefined => {
  const edgeAnchors = node.anchors.filter(
    anchor => anchor.type === 'edge' && anchor.end !== undefined && !anchor.clip
  );

  let closest: ClosestEdgeAnchor | undefined;

  for (const anchor of edgeAnchors) {
    const start = getAnchorPosition(node, anchor, 'start');
    const end = getAnchorPosition(node, anchor, 'end');
    const projected = Line.projectPoint(Line.of(start, end), point);
    const distance = Point.squareDistance(point, projected);

    if (!closest || distance < closest.distance) {
      closest = {
        anchorId: anchor.id,
        point: projected,
        offset: calculateRelativeOffset(
          projected,
          Box.fromOffset(node.bounds, anchor.start),
          node.bounds
        ),
        normal: anchor.normal ?? calculateBoundaryNormal(node, projected),
        distance
      };
    }
  }

  if (closest) {
    return {
      type: 'edge-anchor',
      anchorId: closest.anchorId,
      point: closest.point,
      offset: closest.offset,
      normal: closest.normal
    };
  }

  if (!modifiers.metaKey || !node.getDefinition().hasFlag(NodeFlags.AnchorsBoundary)) {
    return undefined;
  }

  const boundingPath = node.getDefinition().getBoundingPath(node);
  const projectionResult = boundingPath.projectPoint(point);
  const projected = projectionResult.point;

  return {
    type: 'boundary-point',
    point: projected,
    offset: calculateRelativeOffset(projected, node.bounds, node.bounds),
    normal: calculateBoundaryNormalFromPath(node.bounds, boundingPath.all(), projectionResult)
  };
};

const calculateRelativeOffset = (point: Point, ref: Point, bounds: Box) => {
  const relativePoint = Point.subtract(point, ref);
  return Point.rotateAround(
    {
      x: relativePoint.x / bounds.w,
      y: relativePoint.y / bounds.h
    },
    -bounds.r,
    { x: 0.5, y: 0.5 }
  );
};

const calculateBoundaryNormal = (node: DiagramNode, point: Point) => {
  const boundingPath = node.getDefinition().getBoundingPath(node);
  return calculateBoundaryNormalFromPath(
    node.bounds,
    boundingPath.all(),
    boundingPath.projectPoint(point)
  );
};

const calculateBoundaryNormalFromPath = (
  bounds: Box,
  paths: Path[],
  projected: BoundaryProjection
) => {
  const tangent = paths[projected.pathIdx]!.tangentAt(projected.offset);
  let normal = Vector.angle(Vector.tangentToNormal(tangent)) ?? 0;

  if (
    Vector.dotProduct(
      Vector.from(Box.center(bounds), projected.point),
      Vector.fromPolar(normal, 1)
    ) < 0
  ) {
    normal += Math.PI;
  }

  return normal;
};
