import { Path } from '../geometry/path.ts';
import {
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from '../geometry/pathPosition.ts';
import { ConnectedEndpoint, DiagramEdge } from '../model/diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { invariant } from '../utils/assert.ts';
import { ArrowShape } from './arrowShapes.ts';

export const clipPath = (
  path: Path,
  edge: DiagramEdge,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined
) => {
  const diagram = edge.diagram!;

  let start: PointOnPath | undefined;
  let end: PointOnPath | undefined;

  const intersections: WithSegment<PointOnPath>[] = [];
  if (edge.isEndConnected()) {
    const endEndpoint = edge.end as ConnectedEndpoint;
    const endNode = endEndpoint.node;
    const anchor = endNode.getAnchor(endEndpoint.anchor);

    // TODO: Need to handle this better - maybe look for the closest intersection
    //       to the point - and if longer than a few pixels skip the intersection
    const endNodeDefinition = diagram.nodeDefinitions.get(endNode.nodeType);
    const endIntersections = path.intersections(endNodeDefinition.getBoundingPath(endNode));

    if (anchor.clip) {
      intersections.push(...endIntersections);
      // TODO: Handle multiple intersections
      end = endIntersections?.[0] ?? { point: edge.endPosition };
    } else {
      const closeIntersections = endIntersections.filter(
        i => Point.distance(edge.endPosition, i.point) < 1.5 * (endNode.props.stroke?.width ?? 1)
      );
      if (closeIntersections) {
        intersections.push(...closeIntersections);
      }
      end = closeIntersections?.[0] ?? { point: edge.endPosition };
    }
  }
  if (edge.isStartConnected()) {
    const startEndpoint = edge.start as ConnectedEndpoint;
    const startNode = startEndpoint.node;
    const anchor = startNode.getAnchor(startEndpoint.anchor);
    const startNodeDefinition = diagram.nodeDefinitions.get(startNode.nodeType);
    const startIntersections = path.intersections(startNodeDefinition.getBoundingPath(startNode));

    if (anchor.clip) {
      intersections.push(...startIntersections);
      // TODO: Handle multiple intersections
      start = startIntersections?.[0] ?? { point: edge.startPosition };
    } else {
      const closeIntersections = startIntersections.filter(
        i =>
          Point.distance(edge.startPosition, i.point) < 1.5 * (startNode.props.stroke?.width ?? 1)
      );
      if (closeIntersections) {
        intersections.push(...closeIntersections);
      }
      start = closeIntersections?.[0] ?? { point: edge.startPosition };
    }
  }

  if (start) {
    if (end) {
      let startOffset: TimeOffsetOnSegment | undefined;
      let endOffset: TimeOffsetOnSegment | undefined;

      if (startArrow) {
        const baseTOS = PointOnPath.toTimeOffset(start, path);
        const arrowL1 = TimeOffsetOnSegment.toLengthOffsetOnSegment(baseTOS, path);
        // TODO: This 1 is likely the stroke width of the edge
        arrowL1.segmentD += (startArrow.shortenBy ?? 0) + 1;

        startOffset = LengthOffsetOnSegment.toTimeOffsetOnSegment(arrowL1, path);
      } else {
        startOffset = PointOnPath.toTimeOffset(start, path);
      }

      if (endArrow) {
        const baseTOS = PointOnPath.toTimeOffset(end, path);
        const arrowL2 = TimeOffsetOnSegment.toLengthOffsetOnSegment(baseTOS, path);
        // TODO: This 1 is likely the stroke width of the edge
        arrowL2.segmentD -= (endArrow.shortenBy ?? 0) + 1;

        endOffset = LengthOffsetOnSegment.toTimeOffsetOnSegment(arrowL2, path);
      } else {
        endOffset = PointOnPath.toTimeOffset(end, path);
      }

      invariant.is.present(startOffset);
      invariant.is.present(endOffset);

      path = path.split(startOffset, endOffset)[1];
    } else {
      path = path.split(PointOnPath.toTimeOffset(start, path))[1];
    }
  }

  return path;
};
