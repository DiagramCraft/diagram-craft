import { Box } from '@diagram-craft/geometry/box';
import { Transform, TransformFactory, Translation } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import type { DiagramEdge, Waypoint } from '@diagram-craft/model/diagramEdge';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert } from '@diagram-craft/utils/assert';

type EdgeEndpoint = 'start' | 'end';

const isFreeEndpoint = (edge: DiagramEdge, endpoint: EdgeEndpoint) => edge[endpoint] instanceof FreeEndpoint;

const getWaypointControlPoints = (waypoint: Waypoint) => {
  if (!waypoint.controlPoints) return [];

  return Object.values(waypoint.controlPoints).map(cp => Point.add(waypoint.point, cp));
};

const getEdgePoints = (edge: DiagramEdge) => {
  return [
    edge.start.position,
    edge.end.position,
    ...edge.waypoints.flatMap(waypoint => [waypoint.point, ...getWaypointControlPoints(waypoint)])
  ];
};

const getTransformedWaypoint = (
  waypoint: Waypoint,
  transforms: ReadonlyArray<Transform>
): Waypoint => {
  const transformedPoint = Transform.point(waypoint.point, ...transforms);
  if (!waypoint.controlPoints) {
    return { point: transformedPoint };
  }

  const transformedControlPoints = getWaypointControlPoints(waypoint).map(point =>
    Transform.point(point, ...transforms)
  );

  return {
    point: transformedPoint,
    controlPoints: {
      cp1: Point.subtract(transformedControlPoints[0]!, transformedPoint),
      cp2: Point.subtract(transformedControlPoints[1]!, transformedPoint)
    }
  };
};

export const canTransformEdge = (edge: DiagramEdge) => {
  return isFreeEndpoint(edge, 'start') || isFreeEndpoint(edge, 'end');
};

export const getEdgeTransformBounds = (edge: DiagramEdge): Box | undefined => {
  if (!canTransformEdge(edge)) return undefined;
  const rotation = getEdgeRotation(edge);
  const rotatedPoints = getEdgePoints(edge).map(point => Point.rotate(point, -rotation));

  const minX = Math.min(...rotatedPoints.map(point => point.x));
  const maxX = Math.max(...rotatedPoints.map(point => point.x));
  const minY = Math.min(...rotatedPoints.map(point => point.y));
  const maxY = Math.max(...rotatedPoints.map(point => point.y));

  const w = maxX - minX;
  const h = maxY - minY;
  const localCenter = {
    x: minX + w / 2,
    y: minY + h / 2
  };
  const worldCenter = Point.rotate(localCenter, rotation);

  return {
    x: worldCenter.x - w / 2,
    y: worldCenter.y - h / 2,
    w,
    h,
    r: rotation
  };
};

export const getEdgeRotation = (edge: DiagramEdge) => {
  const delta = Point.subtract(edge.end.position, edge.start.position);
  return Math.atan2(delta.y, delta.x);
};

export const applyEdgeTransform = (
  edge: DiagramEdge,
  before: Box,
  after: Box,
  uow: UnitOfWork
) => {
  const transforms = TransformFactory.fromTo(before, after);
  if (transforms.length === 0) return;

  const fixedEndpoint = !isFreeEndpoint(edge, 'start')
    ? 'start'
    : !isFreeEndpoint(edge, 'end')
      ? 'end'
      : undefined;

  const fixedPosition = fixedEndpoint ? edge[fixedEndpoint].position : undefined;
  const compensatedTransforms =
    fixedPosition === undefined
      ? transforms
      : [
          ...transforms,
          new Translation(
            Point.subtract(fixedPosition, Transform.point(fixedPosition, ...transforms))
          )
        ];

  if (isFreeEndpoint(edge, 'start')) {
    edge.setStart(new FreeEndpoint(Transform.point(edge.start.position, ...compensatedTransforms)), uow);
  }

  if (isFreeEndpoint(edge, 'end')) {
    edge.setEnd(new FreeEndpoint(Transform.point(edge.end.position, ...compensatedTransforms)), uow);
  }

  const transformedWaypoints = edge.waypoints.map(waypoint =>
    getTransformedWaypoint(waypoint, compensatedTransforms)
  );

  for (const [i, waypoint] of transformedWaypoints.entries()) {
    edge.replaceWaypoint(i, waypoint, uow);
  }

  if (fixedEndpoint) {
    assert.present(fixedPosition);
    assert.true(Point.isEqual(edge[fixedEndpoint].position, fixedPosition));
  }
};
