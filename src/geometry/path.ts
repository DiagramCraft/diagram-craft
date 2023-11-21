import { Box } from './box.ts';

type PathElement = {
  type: 'moveTo' | 'lineTo' | 'arcTo';
  x: number;
  y: number;
};

export class Path {
  path: PathElement[] = [];

  constructor(
    private readonly type: 'UNIT' | 'SCREEN_UNIT',
    private readonly box: Box
  ) {}

  moveTo(x: number, y: number) {
    this.path.push({ type: 'moveTo', x, y });
  }

  lineTo(x: number, y: number) {
    this.path.push({ type: 'lineTo', x, y });
  }

  arcTo(x: number, y: number) {
    this.path.push({ type: 'arcTo', x, y });
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
            return `M ${x} ${y}`;
          case 'lineTo':
            return `L ${x} ${y}`;
          case 'arcTo':
            return `A ${x} ${y}`;
        }
      })
      .join(' ');
  }

  private toWorldCoordinate(x: number, y: number) {
    const b = this.box;

    const xPart = this.type === 'UNIT' ? (x * b.size.w) / 2 + b.size.w / 2 : x * b.size.w;
    const yPart = this.type === 'UNIT' ? (-y * b.size.h) / 2 + b.size.h / 2 : y * b.size.h;

    return { x: xPart + b.pos.x, y: yPart + b.pos.y };
  }
}
