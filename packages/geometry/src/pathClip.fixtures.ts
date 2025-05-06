import { PathList, PathListBuilder, unitCoordinateSystem } from './pathListBuilder';
import { _p } from './point';
import { applyBooleanOperation } from './pathClip';

const makeCircle = (cx: number, cy: number, r: number) => {
  const b = new PathListBuilder(
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
  const b = new PathListBuilder();
  b.moveTo(_p(x, y));
  b.lineTo(_p(x + w, y));
  b.lineTo(_p(x + w, y + h));
  b.lineTo(_p(x, y + h));
  b.lineTo(_p(x, y));
  return b;
};

export const TEST_CASES = {
  _OnEdge: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathListBuilder()
      .moveTo(_p(-30, 10))
      .lineTo(_p(20, -20))
      .lineTo(_p(80, 20))
      .lineTo(_p(0, 80))
      .lineTo(_p(-30, 10))
  }),
  _OnEdge2: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathListBuilder()
      .moveTo(_p(10, -10))
      .lineTo(_p(40, -20))
      .lineTo(_p(80, 20))
      .lineTo(_p(0, 80))
      .lineTo(_p(10, -10))
  }),
  _NonIntersecting: () => ({
    p1: makeRect(20, 20, 30, 30),
    p2: makeRect(70, 70, 40, 40)
  }),
  CircleOverlappingRectangle: () => ({
    p1: makeRect(50, 50, 300, 200),
    p2: makeCircle(355, 240, 125)
  }),
  CircleInRectangle: () => ({
    p1: makeCircle(210, 200, 125),
    p2: makeRect(50, 50, 350, 300)
  }),
  _CircleInRectangleInverted: () => ({
    p2: makeCircle(210, 200, 125),
    p1: makeRect(50, 50, 350, 300)
  }),
  RectangleInCircle: () => ({
    p1: makeRect(150, 150, 150, 150),
    p2: makeCircle(210, 200, 185)
  }),
  CircleOnRectangle: () => ({
    p1: makeCircle(200, 200, 185),
    p2: makeRect(15, 15, 370, 370)
  }),
  RectOverRectWithHole: () => ({
    p1: makeRect(180, 5, 100, 400),
    p2: makeRect(50, 50, 350, 300).append(makeCircle(210, 200, 125).reverse())
  }),
  CircleOverTwoRects: () => ({
    p1: makeCircle(200, 200, 185),
    p2: makeRect(50, 50, 100, 400).append(makeRect(350, 5, 100, 400))
  }),
  CircleOverCircle: () => ({
    p1: makeCircle(210, 110, 100),
    p2: makeCircle(355, 240, 125)
  }),
  ComplexShapes: () => {
    const holeyRectangle = makeRect(50, 50, 350, 300).append(makeCircle(210, 200, 125).reverse());
    const rectangle = makeRect(180, 5, 100, 400);
    const allParts = applyBooleanOperation(
      rectangle.getPaths(),
      holeyRectangle.getPaths(),
      'A union B'
    );
    return {
      p1: makeCircle(210, 110, 20),
      p2: allParts[0]
    };
  },
  ComplexShapes2: () => {
    const rectangles = makeRect(50, 5, 100, 400).append(makeRect(350, 5, 100, 400));

    const circle = makeCircle(200, 200, 185);

    const a = new PathList(
      applyBooleanOperation(rectangles.getPaths(), circle.getPaths(), 'A union B').flatMap(p =>
        p.all()
      )
    );
    const b = new PathList(
      applyBooleanOperation(rectangles.getPaths(), circle.getPaths(), 'A intersection B').flatMap(
        p => p.all()
      )
    );
    return {
      p2: a,
      p1: b
    };
  },
  TriangleInsideRectangle: () => {
    const b = new PathListBuilder();
    b.moveTo(_p(100, 400));
    b.lineTo(_p(400, 400));
    b.lineTo(_p(250, 250));
    b.lineTo(_p(100, 400));

    return {
      p1: b,
      p2: makeRect(100, 100, 300, 300)
    };
  }
};
