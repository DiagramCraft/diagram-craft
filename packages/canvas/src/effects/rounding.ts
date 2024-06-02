import { PathRenderer, RenderedStyledPath, StyledPath } from '../shape/PathRenderer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { CubicSegment, LineSegment, PathSegment } from '@diagram-craft/geometry/pathSegment';
import { Line } from '@diagram-craft/geometry/line';
import { Path } from '@diagram-craft/geometry/path';
import { Vector } from '@diagram-craft/geometry/vector';
import { BezierUtils } from '@diagram-craft/geometry/bezier';

export class RoundingPathRenderer implements PathRenderer {
  render(el: DiagramElement, path: StyledPath): RenderedStyledPath[] {
    const rounded = applyRounding(el.renderProps.effects.roundingAmount, path.path.segments);
    return [
      {
        path: new Path(
          rounded[0].start,
          rounded.flatMap(r => r.raw())
        ).asSvgPath(),
        style: path.style
      }
    ];
  }
}

const roundLinePair = (
  l1: LineSegment,
  l2: LineSegment,
  rounding: number,
  maxD: number
): [LineSegment, LineSegment, Array<PathSegment>] => {
  const theta = Vector.angleBetween(Vector.from(l1.start, l1.end), Vector.from(l2.start, l2.end));

  const line1 = Line.of(l1.start, l1.end);
  const line2 = Line.of(l2.start, l2.end);

  const determinant =
    (l1.end.x - l1.start.x) * (l2.end.y - l2.start.y) -
    (l2.end.x - l2.start.x) * (l1.end.y - l1.start.y);

  const r = Math.min(rounding, maxD);
  const d = r * Math.tan(theta / 2);

  const p1 = Line.extend(line1, 0, -d);
  const p2 = Line.extend(line2, -d, 0);

  const cubicSegments = BezierUtils.fromArc(
    p1.to.x,
    p1.to.y,
    r,
    r,
    0, //Vector.angle(Vector.from(p1.to, p2.from)),
    0,
    determinant > 0 ? 1 : 0,
    p2.from.x,
    p2.from.y
  );

  let end = p1.to;
  const s = [];
  for (const [, p1x, p1y, p2x, p2y, ex, ey] of cubicSegments) {
    s.push(new CubicSegment(end, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey }));
    end = { x: ex, y: ey };
  }

  return [
    new LineSegment(p1.from, p1.to),
    new LineSegment(p2.from, p2.to),
    s
    //new CubicSegment(p1.to, l1.end, l2.start, p2.from)
  ];
};

// TODO: Maybe change this to use https://observablehq.com/@carpiediem/svg-paths-with-circular-corners
// TODO: This is also found in edgePathBuilder.ts - let's keep in on place
const applyRounding = (rounding: number, segments: ReadonlyArray<PathSegment>) => {
  const d = [...segments];

  // First find shortest line
  let minLineLength = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < d.length; i++) {
    const segment = d[i];
    if (segment instanceof LineSegment) {
      const line = Line.of(segment.start, segment.end);
      minLineLength = Math.min(Line.length(line), minLineLength);
    }
  }

  let pairFound = true;
  while (pairFound) {
    pairFound = false;
    for (let i = 0; i < d.length; i++) {
      const previous = d.at(i - 1);
      const current = d[i];

      if (previous instanceof LineSegment && current instanceof LineSegment) {
        const [p, c, r] = roundLinePair(previous, current, rounding, minLineLength / 1.5);
        d[i - 1 < 0 ? d.length - 1 : i - 1] = p;
        d[i] = c;
        d.splice(i, 0, ...r);

        pairFound = true;
      }
    }
  }

  return d;
};
