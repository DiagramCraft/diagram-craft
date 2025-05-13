import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { CubicBezier } from './bezier';
import { Line } from './line';

const r = new Random(123456);

const randomPoint = (d: number) => {
  return { x: r.nextFloat() * d, y: r.nextFloat() * d };
};

const dimension = 100;

const opts = { time: 2000 };

describe('bezier', () => {
  bench(
    'lengthAt + tAtLength',
    () => {
      const b = new CubicBezier(
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension)
      );

      const t = r.nextFloat();
      const p = b.lengthAtT(t);
      b.tAtLength(p);
    },
    opts
  );

  bench(
    'intersection-line',
    () => {
      const b = new CubicBezier(
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension)
      );
      const l = Line.of(randomPoint(dimension), randomPoint(dimension));

      b.intersectsLine(l);
    },
    opts
  );

  bench(
    ':intersection-bezier',
    () => {
      const b = new CubicBezier(
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension)
      );
      const b2 = new CubicBezier(
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension),
        randomPoint(dimension)
      );

      b.intersectsBezier(b2);
    },
    opts
  );
});
