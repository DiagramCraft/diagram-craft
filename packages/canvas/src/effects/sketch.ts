import {
  PathRenderer,
  RenderedStyledPath,
  StyledPath
} from '@diagram-craft/canvas/shape/PathRenderer';
import { Path } from '@diagram-craft/geometry/path';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Point } from '@diagram-craft/geometry/point';
import { CubicSegment, LineSegment, PathSegment } from '@diagram-craft/geometry/pathSegment';
import { BezierUtils } from '@diagram-craft/geometry/bezier';
import { Vector } from '@diagram-craft/geometry/vector';
import { hash } from '@diagram-craft/utils/hash';
import { Random } from '@diagram-craft/utils/random';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { round } from '@diagram-craft/utils/math';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { parseSvgPath } from '@diagram-craft/geometry/svgPathUtils';
import type { ArrowShape } from '../arrowShapes';

export class SketchPathRenderer implements PathRenderer {
  render(el: DiagramElement, path: StyledPath): RenderedStyledPath[] {
    const svgPathOutline = asDistortedSvgPath(path.path, hash(new TextEncoder().encode(el.id)), {
      passes: 2,
      amount: el.renderProps.effects?.sketchStrength ?? 0.1
    });

    const boundaryStyle = { ...path.style };
    const fillStyle = { ...path.style };

    boundaryStyle.fill = 'none';
    fillStyle.stroke = 'none';

    const dest: RenderedStyledPath[] = [];
    if (isNode(el) && !el.getDefinition().supports('style.fill')) {
      // Do nothing
    } else if (el.renderProps.effects?.sketchFillType === 'hachure') {
      const lines = calculateHachureLines(el.bounds, path.path, Math.PI / 4, 10);
      const hachure = lines.map(l => {
        return asDistortedSvgPath(
          new Path(l.from, [['L', l.to.x, l.to.y]]),
          hash(new TextEncoder().encode(el.id)),
          {
            passes: 2,
            amount: el.renderProps.effects?.sketchStrength ?? 0.1,
            unidirectional: false
          }
        );
      });
      hachure.forEach(l => {
        dest.push({ path: l, style: { stroke: fillStyle.fill, strokeWidth: '1', fill: 'none' } });
      });
    } else if (isEdge(el)) {
      const svgPathFill = asDistortedSvgPath(path.path, hash(new TextEncoder().encode(el.id)), {
        passes: 2,
        amount: el.renderProps.effects?.sketchStrength ?? 0.1,
        unidirectional: true
      });
      dest.push({ path: svgPathFill, style: fillStyle });
    } else {
      const svgPathFill = asDistortedSvgPath(path.path, hash(new TextEncoder().encode(el.id)), {
        passes: 1,
        amount: el.renderProps.effects?.sketchStrength ?? 0.1,
        distortVertices: true
      });
      dest.push({ path: svgPathFill, style: fillStyle });
    }

    dest.push({ path: svgPathOutline, style: boundaryStyle });
    return dest;
  }
}

const calculateHachureLines = (
  bounds: Box,
  path: Path,
  hachureAngle: number,
  hachureGap: number
): Line[] => {
  const hachureGapX = hachureGap;

  const lines: Array<Line> = [];
  for (
    let x = bounds.x;
    x < bounds.x + bounds.w + Math.cos(hachureAngle) * bounds.h;
    x += hachureGapX
  ) {
    lines.push(
      Line.of(
        { x, y: bounds.y },
        { x: x - Math.cos(hachureAngle) * bounds.h, y: bounds.y + bounds.h }
      )
    );
  }

  const dest: Line[] = [];
  for (const line of lines) {
    const intersections = path.intersections(new Path(line.from, [['L', line.to.x, line.to.y]]));
    if (intersections.length > 0) {
      const sortedIntersections = intersections.toSorted((a, b) => a.point.x - b.point.x);

      let inside = false;
      for (let i = 0; i < sortedIntersections.length; i++) {
        if (inside) {
          dest.push(Line.of(sortedIntersections[i - 1]!.point, sortedIntersections[i]!.point));
        }
        inside = !inside;
      }
    }
  }

  return dest;
};

export const applySketchEffectToArrow = (id: string, arrow: ArrowShape) => {
  const seed = hash(new TextEncoder().encode(id));
  return parseArrowSvgPath(arrow.path)
    .map(p => asDistortedSvgPath(p, seed, { passes: 2 }))
    .join(' ');
};

const parseArrowSvgPath = (path: string): Path[] => {
  const dest: [Point, PathSegment[]][] = [];
  let segments: PathSegment[] = [];

  let startPoint: Point | undefined;
  let point: Point | undefined;
  for (const rs of parseSvgPath(path)) {
    if (rs[0] === 'M') {
      point = { x: Number(rs[1]), y: Number(rs[2]) };
      startPoint = point;

      segments = [];
      dest.push([startPoint, segments]);
    } else if (rs[0] === 'm') {
      point = { x: point!.x + Number(rs[1]), y: point!.y + Number(rs[2]) };
      startPoint = point;

      segments = [];
      dest.push([startPoint, segments]);
    } else if (rs[0] === 'L') {
      segments.push(new LineSegment(point!, { x: Number(rs[1]), y: Number(rs[2]) }));
    } else if (rs[0] === 'l') {
      segments.push(
        new LineSegment(point!, { x: point!.x + Number(rs[1]), y: point!.y + Number(rs[2]) })
      );
    } else if (rs[0] === 'A' || rs[0] === 'a') {
      const [, rx, ry, angle, larc, sweep, x2, y2] = rs;
      const cubicSegments = BezierUtils.fromArc(
        point!.x,
        point!.y,
        Number(rx),
        Number(ry),
        Number(angle),
        Number(larc) as 0 | 1,
        Number(sweep) as 0 | 1,
        rs[0] === 'a' ? point!.x + Number(x2) : Number(x2),
        rs[0] === 'a' ? point!.y + Number(y2) : Number(y2)
      );

      for (const [, p1x, p1y, p2x, p2y, ex, ey] of cubicSegments) {
        segments.push(
          new CubicSegment(point!, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey })
        );
        point = { x: ex, y: ey };
      }
    } else if (rs[0] === 'z' || rs[0] === 'Z') {
      segments.push(new LineSegment(point!, startPoint!));
    } else {
      throw new Error(`Unsupported type ${rs[0]} - ${rs.join(' ')}`);
    }

    point = segments.length > 0 ? segments.at(-1)!.end : point;

    if (startPoint === undefined) {
      startPoint = point;
    }
  }

  return dest.map(
    ([point, segs]) =>
      new Path(
        point,
        segs.flatMap(d => d.raw())
      )
  );
};

const randDelta = (r: Random, from: number, to: number) => {
  return {
    x: r.nextRange(from, to),
    y: r.nextRange(from, to)
  };
};

const asDistortedSvgPath = (
  path: Path,
  seed: number,
  opts: {
    passes?: number;
    distortVertices?: boolean;
    unidirectional?: boolean;
    amount?: number;
  }
) => {
  opts.passes ??= 1;
  opts.amount ??= 0.1;
  opts.distortVertices ??= false;
  opts.unidirectional ??= false;

  const r = new Random(seed * opts.passes);

  const endpointDistortion = 50 * opts.amount;
  const maxDistance = 30;

  const distortedPath = [];

  let point = path.start;
  for (let i = 0; i < opts.passes; i++) {
    for (const s of path.segments) {
      point = opts.distortVertices
        ? Point.add(s.end, randDelta(r, -endpointDistortion, endpointDistortion))
        : s.end;

      if (s instanceof LineSegment) {
        const direction = r.nextBoolean();

        const distortion = Math.min(maxDistance, Point.distance(s.start, s.end)) * opts.amount;
        const distortionFrom = opts.unidirectional && direction ? 0 : -distortion;
        const distortionTo = opts.unidirectional && !direction ? 0 : distortion;

        const m = i % 2 === 0 ? [0.5, 0.85] : [0.15, 0.5];
        const d = r.nextRange(m[0]!, m[1]!);
        const midpoint = Point.add(s.start, Vector.scale(Vector.from(s.start, s.end), d));
        const distortedMidpoint = Point.add(midpoint, randDelta(r, distortionFrom, distortionTo));

        distortedPath.push(['Q', distortedMidpoint.x, distortedMidpoint.y, point.x, point.y]);
      } else if (s instanceof CubicSegment) {
        const lc1 = 1.5 * Math.min(maxDistance, Point.distance(s.start, s.p1));
        const nc1 = Point.add(s.p1, randDelta(r, -lc1 * opts.amount, lc1 * opts.amount));
        const lc2 = 1.5 * Math.min(20, Point.distance(s.end, s.p2));
        const nc2 = Point.add(s.p2, randDelta(r, -lc2 * opts.amount, lc2 * opts.amount));

        distortedPath.push(['C', nc1.x, nc1.y, nc2.x, nc2.y, point.x, point.y]);
      } else {
        throw new VerifyNotReached();
      }
    }
    if (i !== opts.passes - 1) distortedPath.push(['M', path.start.x, path.start.y]);
  }

  return (
    `M ${round(path.start.x)},${round(path.start.y)}` +
    distortedPath.map(e => e.join(' ')).join(' ')
  );
};

export const _test = {
  asDistortedSvgPath,
  parseArrowSvgPath
};
