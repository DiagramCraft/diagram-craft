import { PerformanceTest, perftest } from '../utils/perftest.ts';
import { CubicBezier } from './bezier.ts';
import { Line } from './line.ts';

const randomPoint = (d: number) => {
  return { x: Math.random() * d, y: Math.random() * d };
};

export class BezierPerformanceTest implements PerformanceTest {
  setup() {}
  testCases() {
    return [
      {
        label: 'intersection-line',
        run: () => {
          const iter = 10000000;
          for (let i = 0; i < iter; i++) {
            const b = new CubicBezier(
              randomPoint(100),
              randomPoint(100),
              randomPoint(100),
              randomPoint(100)
            );
            const l = Line.of(randomPoint(100), randomPoint(100));

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
              randomPoint(100),
              randomPoint(100),
              randomPoint(100),
              randomPoint(100)
            );
            const b2 = new CubicBezier(
              randomPoint(100),
              randomPoint(100),
              randomPoint(100),
              randomPoint(100)
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
