import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { CubicBezier } from './bezier';
import { Line } from './line';
import { _p } from './point';

const r = new Random(123456);

const randomPoint = (d: number) => {
  return { x: r.nextFloat() * d, y: r.nextFloat() * d };
};

const dimension = 100;

const opts = { time: 1000 };

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
    'intersection-bezier',
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

  bench(
    'projectPoint',
    () => {
      const curve = new CubicBezier(_p(110, 150), _p(25, 190), _p(210, 30), _p(210, 30));

      const point = randomPoint(300);

      curve.projectPoint(point, 0.0001);
    },
    opts
  );
});
