import { Box } from './box.ts';
import { round } from '../utils/math.ts';
import { invariant } from '../utils/assert.ts';
import { Point } from './point.ts';

type PathElement = {
  type: 'moveTo' | 'lineTo' | 'arcTo' | 'curveTo' | 'quadTo' | 'cubicTo';
  x: number;
  y: number;
  control?: number[];
};

export class Path {
  path: PathElement[] = [];

  constructor(
    private readonly type: 'UNIT' | 'SCREEN_UNIT',
    private readonly box?: Box
  ) {}

  moveTo(x: number, y: number) {
    this.path.push({ type: 'moveTo', x, y });
  }

  moveToPoint(p: Point) {
    this.path.push({ type: 'moveTo', ...p });
  }

  lineTo(x: number, y: number) {
    this.path.push({ type: 'lineTo', x, y });
  }

  lineToPoint(p: Point) {
    this.path.push({ type: 'lineTo', ...p });
  }

  arcTo(x: number, y: number) {
    this.path.push({ type: 'arcTo', x, y });
  }

  curveTo(x: number, y: number) {
    this.path.push({ type: 'curveTo', x, y });
  }

  curveToPoint(p: Point) {
    this.path.push({ type: 'curveTo', ...p });
  }

  quadTo(x: number, y: number, x1: number, y1: number) {
    this.path.push({ type: 'quadTo', x: x1, y: y1, control: [x, y] });
  }

  quadToPoint(p: Point, p1: Point) {
    this.path.push({ type: 'quadTo', ...p1, control: [p.x, p.y] });
  }

  cubicTo(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    this.path.push({ type: 'cubicTo', x: x1, y: y1, control: [x2, y2, x, y] });
  }

  cubicToPoint(p: Point, p1: Point, p2: Point) {
    this.path.push({ type: 'cubicTo', ...p1, control: [p2.x, p2.y, p.x, p.y] });
  }

  positionAt(n: number) {
    const { x, y } = this.path[n];
    return this.toWorldCoordinate(x, y);
  }

  asSvgPath() {
    return this.path
      .map(e => {
        const { x, y } = this.toWorldCoordinate(e.x, e.y);

        switch (e.type) {
          case 'moveTo':
            return `M ${round(x)} ${round(y)}`;
          case 'lineTo':
            return `L ${round(x)} ${round(y)}`;
          case 'arcTo':
            return `A ${round(x)} ${round(y)}`;
          case 'curveTo':
            return `T ${round(x)} ${round(y)}`;
          case 'quadTo':
            return `Q ${round(x)} ${round(y)}, ${round(e.control![0])} ${round(e.control![1])}`;
          case 'cubicTo':
            return `C ${round(x)} ${round(y)}, ${round(e.control![0])} ${round(
              e.control![1]
            )}, ${round(e.control![2])} ${round(e.control![3])}`;
        }
      })
      .join(' ');
  }

  private toWorldCoordinate(x: number, y: number) {
    if (this.type === 'SCREEN_UNIT') {
      return { x, y };
    }

    const b = this.box;

    invariant.is.present(b);

    const xPart = this.type === 'UNIT' ? (x * b.size.w) / 2 + b.size.w / 2 : x * b.size.w;
    const yPart = this.type === 'UNIT' ? (-y * b.size.h) / 2 + b.size.h / 2 : y * b.size.h;

    return { x: xPart + b.pos.x, y: yPart + b.pos.y };
  }

  append(path: Path) {
    this.path.push(...path.path);
  }
}
