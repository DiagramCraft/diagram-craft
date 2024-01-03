import { Path } from '../geometry/path.ts';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment
} from '../geometry/pathPosition.ts';
import { ConnectedEndpoint, DiagramEdge, Intersection, isConnected } from './diagramEdge.ts';
import { Point } from '../geometry/point.ts';
import { VERIFY_NOT_REACHED, VerifyNotReached } from '../utils/assert.ts';
import { ArrowShape } from '../base-ui/arrowShapes.ts';
import { Diagram } from './diagram.ts';
import { Vector } from '../geometry/vector.ts';

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

  return basePath;
};

export const applyLineHops = (
  basePath: Path,
  edge: DiagramEdge,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined,
  intersections: Intersection[]
) => {
  const length = basePath.length();
  const gapSize = edge.props.lineHops?.size ?? 10;
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
    .sort((a, b) => a.pathD - b.pathD)
    .map(i => i.intersection);

  if (validIntersections.length === 0) return basePath.asSvgPath();

  for (const intersection of validIntersections) {
    const toSplit = dest.at(-1) ?? basePath;

    const thisType = edge.props.lineHops?.type ?? 'none';

    if (
      thisType !== 'none' &&
      ((thisType.startsWith('below') && intersection.type === 'below') ||
        (thisType.startsWith('above') && intersection.type === 'above'))
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
        addLineHop(dest, before, after, thisType, gapSize);
        dest.push(after);
      } else {
        dest[dest.length - 1] = before;
        addLineHop(dest, before, after, thisType, gapSize);
        dest.push(after);
      }
    }
  }

  if (dest.length === 0) return basePath.asSvgPath();

  return dest.map(p => p.asSvgPath()).join(', ');
};

const addLineHop = (dest: Path[], before: Path, after: Path, type: string, size: number) => {
  if (type === 'below-hide') return;
  else if (type === 'above-arc') {
    dest.push(
      new Path(
        [
          [
            'A',
            size / 2,
            size / 2,
            0,
            1,
            1,
            after.segments.at(0)!.start.x,
            after.segments.at(0)!.start.y
          ]
        ],
        before.segments.at(-1)!.end
      )
    );
  } else if (type === 'below-arc') {
    dest.push(
      new Path(
        [
          [
            'A',
            size / 2,
            size / 2,
            0,
            1,
            0,
            after.segments.at(0)!.start.x,
            after.segments.at(0)!.start.y
          ]
        ],
        before.segments.at(-1)!.end
      )
    );
  } else if (type === 'below-line') {
    const tangentStart = before.tangentAt({ pathD: before.length() - 0.01 });
    const tangentEnd = after.tangentAt({ pathD: 0.01 });

    const lineLength = size * 0.6;

    const normalStart = Point.rotate(tangentStart, Math.PI / 2);
    const normalEnd = Point.rotate(tangentEnd, Math.PI / 2);

    const startStart = Point.add(
      before.segments.at(-1)!.end,
      Vector.scale(normalStart, lineLength / 2)
    );
    const startEnd = Point.subtract(
      before.segments.at(-1)!.end,
      Vector.scale(normalStart, lineLength / 2)
    );

    const endStart = Point.add(
      after.segments.at(0)!.start,
      Vector.scale(normalEnd, lineLength / 2)
    );
    const endEnd = Point.subtract(
      after.segments.at(0)!.start,
      Vector.scale(normalEnd, lineLength / 2)
    );

    if (isNaN(startStart.x) || isNaN(startStart.y) || isNaN(startEnd.x) || isNaN(startEnd.y)) {
      return;
    }
    if (isNaN(endStart.x) || isNaN(endStart.y) || isNaN(endEnd.x) || isNaN(endEnd.y)) {
      return;
    }

    dest.push(new Path([['L', startEnd.x, startEnd.y]], startStart));
    dest.push(new Path([['L', endEnd.x, endEnd.y]], endStart));
  } else {
    VERIFY_NOT_REACHED();
  }
};
