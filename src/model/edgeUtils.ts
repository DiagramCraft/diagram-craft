import { Path } from '../geometry/path.ts';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment
} from '../geometry/pathPosition.ts';
import { ConnectedEndpoint, DiagramEdge, Intersection, isConnected } from './diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { VerifyNotReached } from '../utils/assert.ts';
import { ArrowShape } from '../base-ui/arrowShapes.ts';
import { Diagram } from './diagram.ts';

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
  endArrow: ArrowShape | undefined,
  intersections: Intersection[]
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

  let basePath: Path;
  if (!startOffset && !endOffset) {
    basePath = path;
  } else if (startOffset && endOffset) {
    basePath = path.split(startOffset, endOffset)[1];
  } else if (startOffset) {
    basePath = path.split(startOffset)[1];
  } else if (endOffset) {
    basePath = path.split(endOffset)[0];
  } else {
    throw new VerifyNotReached();
  }

  const length = basePath.length();
  const gapSize = 10;
  const dest: Path[] = [];

  // Sort intersections of length offset on path
  const validIntersections = intersections
    .map(i => ({
      intersection: i,
      // TODO: We could perhaps make this more efficient by remembering the intersecting segment
      //       ... but a bit difficult since we split the path above
      pathD: basePath.projectPoint(i.point).pathD
    }))
    .filter(i => i.pathD >= 0 && i.pathD <= length)
    .filter(i => i.pathD > (startArrow?.height ?? 0) + gapSize / 2)
    .filter(i => i.pathD < length - (endArrow?.height ?? 0) - gapSize / 2)
    .sort((a, b) => a.pathD - b.pathD);

  if (validIntersections.length === 0) return basePath.asSvgPath();

  for (const intersection of validIntersections) {
    const pathD1 = Math.max(0, intersection.pathD - gapSize / 2);
    const pathD2 = Math.min(length, intersection.pathD + gapSize / 2);

    const toSplit = dest.at(-1) ?? basePath;

    /*    if (path.segments.length === 2) {
      console.log(
        LengthOffsetOnSegment.toTimeOffsetOnSegment(
          LengthOffsetOnPath.toLengthOffsetOnSegment({ pathD: pathD1 }, toSplit),
          toSplit
        ),
        LengthOffsetOnSegment.toTimeOffsetOnSegment(
          LengthOffsetOnPath.toLengthOffsetOnSegment({ pathD: pathD2 }, toSplit),
          toSplit
        )
      );
    }*/

    const [before, , after] = toSplit.split(
      LengthOffsetOnSegment.toTimeOffsetOnSegment(
        LengthOffsetOnPath.toLengthOffsetOnSegment({ pathD: pathD1 }, toSplit),
        toSplit
      ),
      LengthOffsetOnSegment.toTimeOffsetOnSegment(
        LengthOffsetOnPath.toLengthOffsetOnSegment({ pathD: pathD2 }, toSplit),
        toSplit
      )
    );

    if (dest.length === 0) {
      dest.push(before);
      dest.push(after);
    } else {
      dest[dest.length - 1] = before;
      dest.push(after);
    }
  }

  return dest.map(p => p.asSvgPath()).join(', ');
};
