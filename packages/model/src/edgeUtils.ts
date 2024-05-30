import { DiagramEdge, Intersection } from './diagramEdge';
import { ConnectedEndpoint, FixedEndpoint, isConnectedOrFixed } from './endpoint';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment
} from '@diagram-craft/geometry/pathPosition';
import { Path } from '@diagram-craft/geometry/path';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { Diagram } from './diagram';
import { VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';

type ArrowShape = {
  height: number;
  shortenBy?: number;
};

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
  endpoint: ConnectedEndpoint | FixedEndpoint,
  endpointPosition: Point,
  path: Path,
  diagram: Diagram
): PointOnPath => {
  const clip =
    endpoint instanceof ConnectedEndpoint ? endpoint.node.getAnchor(endpoint.anchor).clip : true;
  const nodeDefinition = diagram.document.nodeDefinitions.get(endpoint.node.nodeType);

  const endIntersections = nodeDefinition
    .getBoundingPath(endpoint.node)
    .all()
    .flatMap(p => path.intersections(p));

  if (clip) {
    // TODO: Handle multiple intersections
    return endIntersections[0] ?? { point: endpointPosition };
  } else {
    const closeIntersections = endIntersections.filter(
      i =>
        Point.distance(endpointPosition, i.point) <
        1.5 * (endpoint.node.renderProps.stroke?.width ?? 1)
    );
    return closeIntersections[0] ?? { point: endpointPosition };
  }
};

export const clipPath = (
  path: Path,
  edge: DiagramEdge,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined
) => {
  const diagram = edge.diagram!;

  const start = isConnectedOrFixed(edge.start)
    ? intersectWithNode(edge.start, edge.start.position, path, diagram)
    : undefined;
  const startOffset = adjustForArrow(start, startArrow, path, 1);

  const end = isConnectedOrFixed(edge.end)
    ? intersectWithNode(edge.end, edge.end.position, path, diagram)
    : undefined;
  const endOffset = adjustForArrow(end, endArrow, path, -1);

  let basePath: Path;
  if (!startOffset && !endOffset) {
    basePath = path;
  } else if (startOffset && endOffset) {
    if (startOffset.segment === endOffset.segment && startOffset.segmentT === endOffset.segmentT) {
      return undefined;
    }
    basePath = path.split(startOffset, endOffset)[1];
  } else if (startOffset) {
    basePath = path.split(startOffset)[1];
  } else if (endOffset) {
    basePath = path.split(endOffset)[0];
  } else {
    throw new VerifyNotReached();
  }

  basePath.clean();

  return basePath;
};

export const applyLineHops = (
  basePath: Path,
  edge: DiagramEdge,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined,
  intersections: Intersection[]
): Path[] => {
  const thisType = edge.renderProps.lineHops?.type ?? 'none';
  const gapSize = edge.renderProps.lineHops?.size ?? 10;

  if (intersections.length === 0 || thisType === 'none') return [basePath];

  const length = basePath.length();

  // Sort intersections of length offset on path
  const validIntersections = intersections
    .map(i => ({
      intersection: i,
      pathD: basePath.projectPoint(i.point).pathD
    }))
    // Check for bounds of path
    .filter(i => i.pathD >= 0 && i.pathD <= length)

    // Check for potential intersection with arrow drawn
    .filter(i => i.pathD > (startArrow?.height ?? 0) + gapSize / 2)
    .filter(i => i.pathD < length - (endArrow?.height ?? 0) - gapSize / 2)

    // Sort by offset, ascending
    .sort((a, b) => a.pathD - b.pathD)
    .map(i => i.intersection);

  // No need to proceed if there are no valid intersections
  if (validIntersections.length === 0) return [basePath];

  const dest: Path[] = [];
  for (const intersection of validIntersections) {
    const toSplit = dest.at(-1) ?? basePath;

    if (
      (thisType.startsWith('below') && intersection.type === 'below') ||
      (thisType.startsWith('above') && intersection.type === 'above')
    ) {
      const projection = toSplit.projectPoint(intersection.point);

      const pathD1 = Math.max(0, projection.pathD - gapSize / 2);
      const pathD2 = Math.min(length, projection.pathD + gapSize / 2);

      const [before, , after] = toSplit.split(
        LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: pathD1 }, toSplit),
        LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: pathD2 }, toSplit)
      );

      if (dest.length === 0) {
        dest.push(before);
      } else {
        dest[dest.length - 1] = before;
      }
      addLineHop(dest, before, after, thisType, gapSize);
      dest.push(after);
    }
  }

  // If none of the intersections implied drawing a line hop, dest will be empty and
  // we just return the base path
  if (dest.length === 0) return [basePath];

  return dest;
};

const addLineHop = (dest: Path[], before: Path, after: Path, type: string, size: number) => {
  const hSize = size / 2;
  const lineLength = size * 0.6;

  if (type === 'below-hide') return;
  else {
    const end = after.segments.at(0)!.start;
    const start = before.segments.at(-1)!.end;

    if (type === 'above-arc') {
      dest.push(new Path(start, [['A', hSize, hSize, 0, 1, 1, end.x, end.y]]));
    } else if (type === 'below-arc') {
      dest.push(new Path(start, [['A', hSize, hSize, 0, 1, 0, end.x, end.y]]));
    } else if (type === 'below-line') {
      const tangentStart = before.tangentAt({ pathD: before.length() - 0.01 });
      const tangentEnd = after.tangentAt({ pathD: 0.01 });

      const normalStart = Point.rotate(tangentStart, Math.PI / 2);
      const normalEnd = Point.rotate(tangentEnd, Math.PI / 2);

      const startStart = Point.add(start, Vector.scale(normalStart, lineLength / 2));
      const startEnd = Point.subtract(start, Vector.scale(normalStart, lineLength / 2));

      const endStart = Point.add(end, Vector.scale(normalEnd, lineLength / 2));
      const endEnd = Point.subtract(end, Vector.scale(normalEnd, lineLength / 2));

      if (isNaN(startStart.x) || isNaN(startStart.y) || isNaN(startEnd.x) || isNaN(startEnd.y)) {
        return;
      }
      if (isNaN(endStart.x) || isNaN(endStart.y) || isNaN(endEnd.x) || isNaN(endEnd.y)) {
        return;
      }

      dest.push(new Path(startStart, [['L', startEnd.x, startEnd.y]]));
      dest.push(new Path(endStart, [['L', endEnd.x, endEnd.y]]));
    } else {
      VERIFY_NOT_REACHED();
    }
  }
};
