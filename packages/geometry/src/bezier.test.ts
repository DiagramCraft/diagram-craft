import { describe, expect, test } from 'vitest';
import { BezierUtils, CubicBezier } from './bezier';
import { _p } from './point';

describe('BezierUtils', () => {
  test('calculates center', () => {
    expect(BezierUtils.fromArc(100, 100, 30, 50, 0, 0, 1, 162.55, 162.45)).toStrictEqual([
      [
        'C',
        114.42221014085034,
        59.874156707148636,
        149.49859121679208,
        60.81633871164263,
        163.13748593029655,
        101.69592762589153
      ],
      [
        'C',
        169.46731878154637,
        120.66821022579973,
        169.24337041623195,
        143.82753157144174,
        162.55,
        162.45
      ]
    ]);
  });

  describe('overlap', () => {
    test('overlapping subcurves of same curve overlaps', () => {
      const curve = new CubicBezier(_p(0, 0), _p(0, 10), _p(10, 10), _p(10, 0));

      const [, b] = curve.split(0.2);
      const [c] = curve.split(0.7);

      const overlap = b.overlap(c);
      expect(overlap).toBeDefined();
    });

    test('non-overlapping subcurves of same curve does not overlap', () => {
      const curve = new CubicBezier(_p(0, 0), _p(0, 10), _p(10, 10), _p(10, 0));

      const [, b] = curve.split(0.5);
      const [c] = curve.split(0.5);

      const overlap = b.overlap(c);
      expect(overlap).toBeUndefined();
    });
  });

  describe('projectPoint', () => {
    test('close to endpoint', () => {
      const curve = new CubicBezier(_p(110, 150), _p(25, 190), _p(210, 250), _p(210, 30));
      const point = _p(227, 13);

      const pp = curve.projectPoint(point, 0.0001);

      expect(pp.point.x).toBeCloseTo(210, 1);
      expect(pp.point.y).toBeCloseTo(30, 1);
      expect(pp.t).toBeCloseTo(1, 3);
    });

    test('in the middle', () => {
      const curve = new CubicBezier(_p(110, 150), _p(25, 190), _p(210, 250), _p(210, 30));
      const point = _p(182, 161);

      const pp = curve.projectPoint(point, 0.0001);

      expect(pp.point.x).toBeCloseTo(175.9416, 3);
      expect(pp.point.y).toBeCloseTo(156.2064, 3);
      expect(pp.t).toBeCloseTo(0.717, 3);
    });
  });
});
