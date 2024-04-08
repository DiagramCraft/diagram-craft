import { PerformanceTest, perftest, Random } from '@diagram-craft/utils';
import { CubicBezier } from './bezier.ts';
import { Line } from './line.ts';

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
