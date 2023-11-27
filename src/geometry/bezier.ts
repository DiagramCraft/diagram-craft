import { Point } from './point.ts';
import { Cubic } from './path.ts';

const PI = Math.PI;
const _120 = (PI * 120) / 180;

const rotate = (x: number, y: number, rad: number): Point => {
  return { x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) };
};

export const Bezier = {
  fromArc: (
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    angle: number,
    large_arc_flag: 0 | 1,
    sweep_flag: 0 | 1,
    x2: number,
    y2: number,
    recursive?: [number, number, number, number] | undefined
  ): Cubic[] => {
    const rad = (PI / 180) * (angle ?? 0);

    if (!rx || !ry) {
      return [['C', x1, y1, x2, y2, x2, y2]];
    }

    let f1: number;
    let f2: number;
    let cx: number;
    let cy: number;

    if (recursive) {
      [f1, f2, cx, cy] = recursive;
    } else {
      const rot1 = rotate(x1, y1, -rad);
      x1 = rot1.x;
      y1 = rot1.y;

      const rot2 = rotate(x2, y2, -rad);
      x2 = rot2.x;
      y2 = rot2.y;

      const x = (x1 - x2) / 2;
      const y = (y1 - y2) / 2;

      const h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (h > 1) {
        const hSq = Math.sqrt(h);
        rx = hSq * rx;
        ry = hSq * ry;
      }

      const rx2 = rx * rx;
      const ry2 = ry * ry;
      const k =
        (large_arc_flag === sweep_flag ? -1 : 1) *
        Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));

      cx = (k * rx * y) / ry + (x1 + x2) / 2;
      cy = (k * -ry * x) / rx + (y1 + y2) / 2;

      f1 = Math.asin(Number(((y1 - cy) / ry).toFixed(9)));
      f2 = Math.asin(Number(((y2 - cy) / ry).toFixed(9)));

      f1 = x1 < cx ? PI - f1 : f1;
      f2 = x2 < cx ? PI - f2 : f2;
      f1 < 0 && (f1 = PI * 2 + f1);
      f2 < 0 && (f2 = PI * 2 + f2);

      if (sweep_flag && f1 > f2) {
        f1 -= PI * 2;
      }
      if (!sweep_flag && f2 > f1) {
        f2 -= PI * 2;
      }
    }

    const res: Cubic[] = [];

    if (Math.abs(f2 - f1) > _120) {
      const f2old = f2;
      const x2old = x2;
      const y2old = y2;

      f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
      x2 = cx + rx * Math.cos(f2);
      y2 = cy + ry * Math.sin(f2);
      res.push(
        ...Bezier.fromArc(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy])
      );
    }

    const t = Math.tan((f2 - f1) / 4);
    const hx = (4 / 3) * rx * t;
    const hy = (4 / 3) * ry * t;

    const m2 = [x1 - hx * Math.sin(f1), y1 + hy * Math.cos(f1)];
    const m3 = [x2 + hx * Math.sin(f2), y2 - hy * Math.cos(f2)];
    const m4 = [x2, y2];

    if (recursive) {
      return [['C', m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], ...res];
    } else {
      const flattened = [['C', m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], ...res].flat();

      const dest: Cubic[] = [];
      for (let i = 0; i < flattened.length; i += 7) {
        dest.push([
          'C',
          rotate(flattened[i + 1] as number, flattened[i + 2] as number, rad).x,
          rotate(flattened[i + 1] as number, flattened[i + 2] as number, rad).y,
          rotate(flattened[i + 3] as number, flattened[i + 4] as number, rad).x,
          rotate(flattened[i + 3] as number, flattened[i + 4] as number, rad).y,
          rotate(flattened[i + 5] as number, flattened[i + 6] as number, rad).x,
          rotate(flattened[i + 5] as number, flattened[i + 6] as number, rad).y
        ] as Cubic);
      }
      return dest;
    }
  }
};
