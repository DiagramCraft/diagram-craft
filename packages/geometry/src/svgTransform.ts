import type { Point } from './point';

interface TransformOperation {
  type: 'translate' | 'rotate' | 'scale';
  values: number[];
}

type TransformationMatrix = [number, number, number, number, number, number];

const multiply = (m1: TransformationMatrix, m2: TransformationMatrix): TransformationMatrix => {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2
  ];
};

export class SvgTransformBuilder {
  private operations: TransformOperation[] = [];

  constructor(private readonly center?: Point) {
    if (center) {
      this.translate(center.x, center.y);
    }
  }

  translate(x: number, y: number) {
    this.operations.push({ type: 'translate', values: [x, y] });
    return this;
  }

  rotate(angle: number, cx?: number, cy?: number) {
    if (cx !== undefined && cy !== undefined && cx !== 0 && cy !== 0) {
      this.operations.push({ type: 'rotate', values: [angle, cx, cy] });
    } else {
      this.operations.push({ type: 'rotate', values: [angle] });
    }
    return this;
  }

  scale(sx: number, sy?: number) {
    this.operations.push({ type: 'scale', values: sy !== undefined ? [sx, sy] : [sx] });
    return this;
  }

  build() {
    if (this.center) this.translate(-this.center.x, -this.center.y);
    return new SvgTransform(this.operations);
  }
}

export class SvgTransform {
  matrix: TransformationMatrix;

  constructor(operations: TransformOperation[] = []) {
    this.matrix = [1, 0, 0, 1, 0, 0];

    for (const op of operations.reverse()) {
      this.applyOperation(op);
    }
  }

  private applyOperation(op: TransformOperation) {
    let opMatrix: TransformationMatrix;

    switch (op.type) {
      case 'translate': {
        const [x, y] = op.values as [number, number];
        opMatrix = [1, 0, 0, 1, x, y];
        break;
      }
      case 'scale': {
        const [sx, sy = sx] = op.values as [number, number];
        opMatrix = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case 'rotate': {
        const [angle, cx, cy] = op.values as [number, number | undefined, number | undefined];
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        if (cx !== undefined && cy !== undefined && cx !== 0 && cy !== 0) {
          const translateMatrix = [1, 0, 0, 1, cx, cy] satisfies TransformationMatrix;
          const rotateMatrix = [cos, sin, -sin, cos, 0, 0] satisfies TransformationMatrix;
          const translateBackMatrix = [1, 0, 0, 1, -cx, -cy] satisfies TransformationMatrix;

          opMatrix = multiply(translateMatrix, multiply(rotateMatrix, translateBackMatrix));
        } else {
          opMatrix = [cos, sin, -sin, cos, 0, 0];
        }
        break;
      }
    }

    this.matrix = multiply(this.matrix, opMatrix);
  }

  asSvgString(): string {
    const [a, b, c, d, e, f] = this.matrix;

    if (a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0) {
      return '';
    }

    const formatNumber = (n: number) => {
      const rounded = Math.round(n * 1000000) / 1000000;
      return rounded === Math.floor(rounded) ? rounded.toString() : rounded.toString();
    };

    return `matrix(${formatNumber(a)},${formatNumber(b)},${formatNumber(c)},${formatNumber(d)},${formatNumber(e)},${formatNumber(f)})`;
  }

  transformPoint(p: Point): Point {
    const [a, b, c, d, e, f] = this.matrix;
    return {
      x: a * p.x + c * p.y + e,
      y: b * p.x + d * p.y + f
    };
  }
}
