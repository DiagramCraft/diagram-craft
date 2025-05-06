import { describe, expect, it } from 'vitest';
import { PathListBuilder } from './pathListBuilder';
import { Box } from './box';
import { CubicSegment, LineSegment, QuadSegment } from './pathSegment';
import { TransformFactory } from './transform';

describe('PathListBuilder', () => {
  describe('setTransform', () => {
    it('scales a path correctly with uniform scaling factors', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 L 10 10 L 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments).toEqual([
        new LineSegment({ x: 0, y: 0 }, { x: 20, y: 20 }),
        new LineSegment({ x: 20, y: 20 }, { x: 40, y: 40 })
      ]);
    });
    it('scales a path correctly with non-uniform scaling factors', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 20, h: 30, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 L 10 10 L 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments).toEqual([
        new LineSegment({ x: 0, y: 0 }, { x: 20, y: 30 }),
        new LineSegment({ x: 20, y: 30 }, { x: 40, y: 60 })
      ]);
    });

    it('scales a path correctly with translation', () => {
      const fromBounds: Box = { x: 5, y: 5, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 10, y: 10, w: 20, h: 20, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 5 5 L 15 15 L 25 25`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 10, y: 10 });
      expect(scaledPath.segments).toEqual([
        new LineSegment({ x: 10, y: 10 }, { x: 20, y: 20 }),
        new LineSegment({ x: 20, y: 20 }, { x: 30, y: 30 })
      ]);
    });

    it('scales a path with cubic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 C 5 5 10 10 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments).toEqual([
        new CubicSegment({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 40, y: 40 })
      ]);
    });

    it('scales a path with quadratic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 Q 10 10 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]).toBeInstanceOf(QuadSegment);
      expect(scaledPath.segments[0].start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0].end).toEqual({ x: 40, y: 40 });
      expect((scaledPath.segments[0] as QuadSegment).quadP1).toEqual({ x: 20, y: 20 });
    });

    it('scales a path with smooth quadratic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 30, h: 30, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 60, h: 60, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 Q 10 10 20 20 T 30 30`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]).toBeInstanceOf(QuadSegment);
      expect(scaledPath.segments[1].start).toEqual({ x: 40, y: 40 });
      expect(scaledPath.segments[1].end).toEqual({ x: 60, y: 60 });
    });

    it('scales a path with arc segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 A 10 10 0 0 1 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      // Arc segments are converted to cubic segments internally
      expect(scaledPath.segments[0].start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0].end.x).toBeCloseTo(47.32);
      expect(scaledPath.segments[0].end.y).toBeCloseTo(12.679);
    });

    it('handles zero scaling correctly', () => {
      const fromBounds: Box = { x: 10, y: 10, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 5, y: 5, w: 0, h: 0, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 10 10 L 20 20`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 5, y: 5 });
      expect(scaledPath.segments[0].start).toEqual({ x: 5, y: 5 });
      expect(scaledPath.segments[0].end).toEqual({ x: 5, y: 5 });
    });

    it('handles negative scaling correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: -10, h: -10, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 L 10 10`)
        .setTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singularPath();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0].start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0].end).toEqual({ x: -10, y: -10 });
    });
  });
});
