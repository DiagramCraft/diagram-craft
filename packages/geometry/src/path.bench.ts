import { bench } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { PathListBuilder } from './pathListBuilder';
import { Path } from './path';

const r = new Random(123456);

const randomPoint = (d: number) => {
  return { x: r.nextFloat() * d, y: r.nextFloat() * d };
};

const randomPath = (d: number): Path => {
  const length = r.nextRange(1, 7);
  const builder = new PathListBuilder();
  builder.moveTo(randomPoint(d));

  for (let i = 0; i < length; i++) {
    if (r.nextBoolean()) {
      builder.lineTo(randomPoint(d));
    } else {
      builder.cubicTo(randomPoint(d), randomPoint(d), randomPoint(d));
    }
  }
  return builder.getPaths().singular();
};

const dimension = 100;

const opts = { time: 2000 };
const runIntersection = () => {
  const p1 = randomPath(dimension);
  const p2 = randomPath(dimension);
  p1.intersections(p2);
};

bench(
  'intersection',
  () => {
    for (let i = 0; i < 100; i++) {
      runIntersection();
    }
  },
  opts
);
