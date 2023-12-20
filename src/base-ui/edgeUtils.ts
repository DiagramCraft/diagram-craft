import { Path } from '../geometry/path.ts';
import {
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment
} from '../geometry/pathPosition.ts';
import { ConnectedEndpoint, DiagramEdge, isConnected } from '../model/diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { VerifyNotReached } from '../utils/assert.ts';
import { ArrowShape } from './arrowShapes.ts';
import { Diagram } from '../model/diagram.ts';

const adjustForArrow = (
  pointOnPath: PointOnPath | undefined,
  arrow: ArrowShape | undefined,
  path: Path,
  adjust: -1 | 1
): TimeOffsetOnSegment | undefined => {
  if (!pointOnPath) return undefined;

  if (arrow) {
    const baseTOS = PointOnPath.toTimeOffset(pointOnPath, path);
    const arrowL1 = TimeOffsetOnSegment.toLengthOffsetOnSegment(baseTOS, path);
    // TODO: This 1 (adjust) is likely the stroke width of the edge
    arrowL1.segmentD += (arrow.shortenBy ?? 0) + adjust;

    return LengthOffsetOnSegment.toTimeOffsetOnSegment(arrowL1, path);
  } else {
    return PointOnPath.toTimeOffset(pointOnPath, path);
  }
};

const intersectWithNode = (
  endpoint: ConnectedEndpoint,
  endpointPosition: Point,
  path: Path,
  diagram: Diagram
): PointOnPath => {
  const anchor = endpoint.node.getAnchor(endpoint.anchor);
  const nodeDefinition = diagram.nodeDefinitions.get(endpoint.node.nodeType);
  const endIntersections = path.intersections(nodeDefinition.getBoundingPath(endpoint.node));

  if (anchor.clip) {
    // TODO: Handle multiple intersections
    return endIntersections?.[0] ?? { point: endpointPosition };
  } else {
    const closeIntersections = endIntersections.filter(
      i =>
        Point.distance(endpointPosition, i.point) < 1.5 * (endpoint.node.props.stroke?.width ?? 1)
    );
    return closeIntersections?.[0] ?? { point: endpointPosition };
  }
};

export const clipPath = (
  path: Path,
  edge: DiagramEdge,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined
) => {
  const diagram = edge.diagram!;

  const start = isConnected(edge.start)
    ? intersectWithNode(edge.start, edge.startPosition, path, diagram)
    : undefined;
  const startOffset = adjustForArrow(start, startArrow, path, 1);

  const end = isConnected(edge.end)
    ? intersectWithNode(edge.end, edge.endPosition, path, diagram)
    : undefined;
  const endOffset = adjustForArrow(end, endArrow, path, -1);

  if (!startOffset && !endOffset) {
    return path;
  } else if (startOffset && endOffset) {
    return path.split(startOffset, endOffset)[1];
  } else if (startOffset) {
    return path.split(startOffset)[1];
  } else if (endOffset) {
    return path.split(endOffset)[0];
  } else {
    throw new VerifyNotReached();
  }
};
