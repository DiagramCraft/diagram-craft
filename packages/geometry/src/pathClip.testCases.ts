import { PathBuilder, unitCoordinateSystem } from './pathBuilder';
import { _p } from './point';

const makeCircle = (cx: number, cy: number, r: number) => {
  const b = new PathBuilder(
    unitCoordinateSystem({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, r: 0 })
  );
  b.moveTo(_p(0.5, 0));
  b.arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1);
  b.arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1);
  b.arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1);
  b.arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1);
  return b;
};

const makeRect = (x: number, y: number, w: number, h: number) => {
  const b = new PathBuilder();
  b.moveTo(_p(x, y));
  b.lineTo(_p(x + w, y));
  b.lineTo(_p(x + w, y + h));
  b.lineTo(_p(x, y + h));
  b.lineTo(_p(x, y));
  return b;
};

export const TEST_CASES = {
  OnEdge: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathBuilder()
      .moveTo(_p(-30, 10))
      .lineTo(_p(20, -20))
      .lineTo(_p(80, 20))
      .lineTo(_p(0, 80))
      .lineTo(_p(-30, 10))
  }),
  OnEdge2: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathBuilder()
      .moveTo(_p(10, -10))
      .lineTo(_p(40, -20))
      .lineTo(_p(80, 20))
      .lineTo(_p(0, 80))
      .lineTo(_p(10, -10))
  }),
  NonIntersecting: () => ({
    p1: makeRect(20, 20, 30, 30),
    p2: makeRect(70, 70, 40, 40)
  }),
  CircleOverlappingRectangle: () => ({
    p1: makeRect(50, 50, 300, 200),
    p2: makeCircle(355, 240, 125)
  })
};
