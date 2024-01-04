import { PerformanceTest, perftest } from '../utils/perftest.ts';
import { CubicBezier } from './bezier.ts';
import { Line } from './line.ts';

class Random {
  #seed: number;

  constructor(seed: number) {
    this.#seed = seed % 2147483647;
    if (this.#seed <= 0) this.#seed += 2147483646;
  }

  next() {
    return (this.#seed = (this.#seed * 16807) % 2147483647);
  }

  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }
}

const r = new Random(123456);

const randomPoint = (d: number) => {
  return { x: r.nextFloat() * d, y: r.nextFloat() * d };
};

const dimension = 100;

export class BezierPerformanceTest implements PerformanceTest {
  setup() {}
  testCases() {
    return [
      {
        label: 'lengthAt + tAtLength',
        run: () => {
          const iter = 5000000;
          for (let i = 0; i < iter; i++) {
            const b = new CubicBezier(
              randomPoint(dimension),
              randomPoint(dimension),
              randomPoint(dimension),
              randomPoint(dimension)
            );

            const t = r.nextFloat();
            const p = b.lengthAtT(t);
            b.tAtLength(p);
          }
          return iter;
        }
      },
      {
        label: 'intersection-line',
        run: () => {
          const iter = 10000000;
          for (let i = 0; i < iter; i++) {
            const b = new CubicBezier(
              randomPoint(dimension),
              randomPoint(dimension),
              randomPoint(dimension),
              randomPoint(dimension)
            );
            const l = Line.of(randomPoint(dimension), randomPoint(dimension));

            b.intersectsLine(l);
          }
          return iter;
        }
      },
      {
        label: 'intersection-bezier',
        run: () => {
          const iter = 150000;
          for (let i = 0; i < iter; i++) {
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
          }
          return iter;
        }
      }
    ];
  }
}

export const runBezierPerftest = () => {
  perftest(new BezierPerformanceTest());
};

runBezierPerftest();
