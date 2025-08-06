import { PathListBuilder } from './pathListBuilder';
import { _p } from './point';
import { applyBooleanOperation } from './pathClip';
import { PathList } from './pathList';

const makeCircle = (cx: number, cy: number, r: number) => {
  const b = new PathListBuilder();
  b.moveTo(_p(cx, cy - r));
  b.arcTo(_p(cx + r, cy), r, r, 0, 0, 1);
  b.arcTo(_p(cx, cy + r), r, r, 0, 0, 1);
  b.arcTo(_p(cx - r, cy), r, r, 0, 0, 1);
  b.arcTo(_p(cx, cy - r), r, r, 0, 0, 1);
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

/**
 * These fixtures are all taken and ported from https://github.com/lrtitze/Swift-VectorBoolean
 *
 * The algorithm, however, is implemented indepedently and based directly on
 * the original paper https://www.inf.usi.ch/hormann/papers/Greiner.1998.ECO.pdf
 */

export const EXTRA_TEST_CASES = {
  OnEdge: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathListBuilder()
      .moveTo(_p(-30, 10))
      .lineTo(_p(20, -20))
      .lineTo(_p(80, 20))
      .lineTo(_p(0, 80))
      .lineTo(_p(-30, 10))
  }),
  OnEdge2: () => ({
    p1: makeRect(0, 0, 100, 100),
    p2: new PathListBuilder()
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
  CircleInRectangleInverted: () => ({
    p2: makeCircle(210, 200, 125),
    p1: makeRect(50, 50, 350, 300)
  }),
  RightTriangleOverRectangle: () => ({
    p2: new PathListBuilder()
      .moveTo(_p(100, 0))
      .lineTo(_p(100, 100))
      .lineTo(_p(0, 100))
      .lineTo(_p(100, 0)),
    p1: makeRect(0, 0, 100, 100)
  })
};

export const VECTOR_BOOLEAN_TEST_CASES = {
  CircleOverlappingRectangle: () => ({
    p1: makeRect(50, 50, 300, 200),
    p2: makeCircle(355, 240, 125)
  }),
  CircleInRectangle: () => ({
    p1: makeCircle(210, 200, 125),
    p2: makeRect(50, 50, 350, 300)
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
  },
  DiamondOverlappingRectangle: () => {
    const b = makeRect(50, 50, 200, 200);
    const a = new PathListBuilder();
    a.moveTo(_p(50, 250));
    a.lineTo(_p(150, 400));
    a.lineTo(_p(250, 250));
    a.lineTo(_p(150, 100));
    a.lineTo(_p(50, 250));
    return {
      p1: b,
      p2: a
    };
  },
  DiamondInsideRectangle: () => {
    const b = makeRect(100, 100, 300, 300);
    const a = new PathListBuilder();
    a.moveTo(_p(100, 250));
    a.lineTo(_p(250, 400));
    a.lineTo(_p(400, 250));
    a.lineTo(_p(250, 100));
    a.lineTo(_p(100, 250));
    return {
      p1: a,
      p2: b
    };
  },
  NonOverlappingContours: () => {
    const a = makeRect(100, 200, 200, 200);

    const b = makeCircle(200, 300, 85).append(makeCircle(200, 95, 85));
    return {
      p1: a,
      p2: b
    };
  },
  MoreNonOverlappingContours: () => {
    const a = makeRect(100, 200, 200, 200).append(makeRect(175, 70, 50, 50));

    const b = makeCircle(200, 300, 85).append(makeCircle(200, 95, 85));
    return {
      p1: a,
      p2: b
    };
  },
  ConcentricContours: () => {
    const a = makeRect(50, 50, 350, 300).append(makeCircle(210, 200, 125));
    const b = makeCircle(210, 200, 140);
    return {
      p1: a,
      p2: b
    };
  },
  MoreConcentricContours: () => {
    const a = PathListBuilder.fromPathList(
      makeRect(50, 50, 350, 300)
        .append(makeCircle(210, 200, 125))
        .getPaths()
        .normalize()
    );
    const b = makeCircle(210, 200, 70);
    return {
      p1: a,
      p2: b
    };
  },
  CircleOverlappingHole: () => {
    const a = PathListBuilder.fromPathList(
      makeRect(50, 50, 350, 300)
        .append(makeCircle(210, 200, 125))
        .getPaths()
        .normalize()
    );
    const b = makeCircle(180, 180, 125);
    return {
      p1: a,
      p2: b
    };
  },
  RectWithHoleOverRectWithHole: () => {
    const a = PathListBuilder.fromPathList(
      makeRect(50, 50, 350, 300)
        .append(makeCircle(210, 200, 125))
        .getPaths()
        .normalize()
    );
    const b = PathListBuilder.fromPathList(
      makeRect(225, 65, 160, 160)
        .append(makeCircle(305, 145, 60))
        .getPaths()
        .normalize()
    );
    return {
      p1: a,
      p2: b
    };
  },
  CurveOverlappingRect: () => {
    const top = 65.0 + 160.0 / 3.0;
    const a = new PathListBuilder()
      .moveTo(_p(40, top))
      .lineTo(_p(410, top))
      .lineTo(_p(410, 50))
      .lineTo(_p(40, 50))
      .lineTo(_p(40, top));

    const b = new PathListBuilder()
      .moveTo(_p(335, 203))
      .cubicTo(_p(335, 200), _p(335, 202), _p(335, 201))
      .cubicTo(_p(270, 90), _p(335, 153), _p(309, 111))
      .cubicTo(_p(240, 145), _p(252, 102), _p(240, 122))
      .cubicTo(_p(305, 210), _p(240, 181), _p(269, 210))
      .cubicTo(_p(335, 203), _p(316, 210), _p(326, 207));
    return {
      p1: a,
      p2: b
    };
  }
};

export const VECTOR_BOOLEAN_DEBUG_TEST_CASES = {
  Debug: () => {
    const p1 = new PathList(
      applyBooleanOperation(
        makeRect(50, 50, 250, 200).getPaths(),
        makeCircle(275, 275, 125).getPaths(),
        'A union B'
      ).flatMap(p => p.all())
    );

    const p2 = makeCircle(210, 110, 20);
    return {
      p1,
      p2
    };
  },
  DebugQuadCurve: () => {
    const p1 = makeCircle(130, 125, 20);
    const p2 = new PathListBuilder()
      .moveTo(_p(50, 50))
      .lineTo(_p(50, 100))
      .quadTo(_p(150, 100), _p(100, 150))
      .lineTo(_p(150, 50))
      .lineTo(_p(50, 50));

    return { p1, p2 };
  },
  Debug001: () => {
    const p1 = makeCircle(210, 110, 20);
    const p2 = new PathList(
      applyBooleanOperation(
        makeRect(50, 50, 250, 200).getPaths(),
        makeRect(150, 150, 250, 250).getPaths(),
        'A union B'
      ).flatMap(p => p.all())
    );

    return { p1, p2 };
  }
};
