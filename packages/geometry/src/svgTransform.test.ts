import { describe, test, expect } from 'vitest';
import { SvgTransform, SvgTransformBuilder } from './svgTransform';

describe('SvgTransformBuilder', () => {
  test('should chain translate operations', () => {
    const transform = new SvgTransformBuilder().translate(10, 20).translate(5, 10).build();

    const point = { x: 0, y: 0 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 15, y: 30 });
  });

  test('should chain scale operations', () => {
    const transform = new SvgTransformBuilder().scale(2, 3).scale(2, 1).build();

    const point = { x: 1, y: 1 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 4, y: 3 });
  });

  test('should chain rotate operations', () => {
    const transform = new SvgTransformBuilder().rotate(90).rotate(90).build();

    const point = { x: 1, y: 0 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(-1, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  test('should handle rotation with center point', () => {
    const transform = new SvgTransformBuilder().rotate(90, 1, 1).build();

    const point = { x: 2, y: 1 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(-3, 10);
    expect(result.y).toBeCloseTo(2, 10);
  });

  test('should handle complex transformation chains', () => {
    const transform = new SvgTransformBuilder().translate(10, 20).rotate(90).scale(2, 3).build();

    const point = { x: 1, y: 0 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(10, 10);
    expect(result.y).toBeCloseTo(22, 10);
  });
});

describe('SvgTransform', () => {
  test('should transform points correctly with translation', () => {
    const transform = new SvgTransformBuilder().translate(10, 20).build();

    const point = { x: 5, y: 15 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 15, y: 35 });
  });

  test('should transform points correctly with scaling', () => {
    const transform = new SvgTransformBuilder().scale(2, 3).build();

    const point = { x: 4, y: 6 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 8, y: 18 });
  });

  test('should handle uniform scaling', () => {
    const transform = new SvgTransformBuilder().scale(2).build();

    const point = { x: 3, y: 4 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 6, y: 8 });
  });

  test('should transform points correctly with rotation', () => {
    const transform = new SvgTransformBuilder().rotate(90).build();

    const point = { x: 1, y: 0 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(1, 10);
  });

  test('should transform points correctly with 45 degree rotation', () => {
    const transform = new SvgTransformBuilder().rotate(45).build();

    const point = { x: 1, y: 0 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(Math.cos(Math.PI / 4), 10);
    expect(result.y).toBeCloseTo(Math.sin(Math.PI / 4), 10);
  });

  test('should handle rotation around center point', () => {
    const transform = new SvgTransformBuilder().rotate(180, 5, 5).build();

    const point = { x: 6, y: 5 };
    const result = transform.transformPoint(point);
    expect(result.x).toBeCloseTo(-16, 10);
    expect(result.y).toBeCloseTo(-15, 10);
  });

  test('should generate correct SVG string for identity', () => {
    const transform = new SvgTransform();
    expect(transform.asSvgString()).toBe('');
  });

  test('should generate correct SVG string for simple transform', () => {
    const transform = new SvgTransformBuilder().translate(10, 20).build();

    expect(transform.asSvgString()).toBe('matrix(1,0,0,1,10,20)');
  });

  test('should generate correct SVG string for complex transform', () => {
    const transform = new SvgTransformBuilder().scale(2, 3).translate(5, 10).build();
    expect(transform.asSvgString()).toBe('matrix(2,0,0,3,10,30)');
  });

  test('should preserve precision in transformations', () => {
    const transform = new SvgTransformBuilder().translate(0.123456789, 0.987654321).build();

    const point = { x: 0, y: 0 };
    const result = transform.transformPoint(point);

    expect(result.x).toBe(0.123456789);
    expect(result.y).toBe(0.987654321);
  });
});

describe('SVG Transform compatibility', () => {
  test('should match SVG transform semantics for translation', () => {
    const transform = new SvgTransformBuilder().translate(50, 100).build();

    expect(transform.asSvgString()).toBe('matrix(1,0,0,1,50,100)');

    const point = { x: 10, y: 20 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 60, y: 120 });
  });

  test('should match SVG transform semantics for scaling', () => {
    const transform = new SvgTransformBuilder().scale(1.5, 2).build();

    expect(transform.asSvgString()).toBe('matrix(1.5,0,0,2,0,0)');

    const point = { x: 10, y: 20 };
    const result = transform.transformPoint(point);
    expect(result).toEqual({ x: 15, y: 40 });
  });

  test('should match SVG transform semantics for rotation', () => {
    const transform = new SvgTransformBuilder().rotate(30).build();

    const cos30 = Math.cos((30 * Math.PI) / 180);
    const sin30 = Math.sin((30 * Math.PI) / 180);

    const point = { x: 100, y: 0 };
    const result = transform.transformPoint(point);

    expect(result.x).toBeCloseTo(100 * cos30, 10);
    expect(result.y).toBeCloseTo(100 * sin30, 10);
  });

  test('should match SVG transform order semantics', () => {
    const transform = new SvgTransformBuilder().translate(100, 0).rotate(90).build();

    const point = { x: 50, y: 0 };
    const result = transform.transformPoint(point);

    // Transform order: translate then rotate
    // With correct SVG order: rotate then translate
    expect(result.x).toBeCloseTo(100, 10);
    expect(result.y).toBeCloseTo(50, 10);
  });
});
