import { describe, expect, it } from 'vitest';
import { PathListBuilder, fromUnitLCS, toUnitLCS } from './pathListBuilder';
import { Box } from './box';
import { CubicSegment, LineSegment, QuadSegment } from './pathSegment';
import { Transform, TransformFactory } from './transform';

describe('PathListBuilder', () => {
  describe('.active', () => {
    it('returns the initial state of the active path', () => {
      const builder = new PathListBuilder();

      expect(builder.active.start).toBeUndefined();
      expect(builder.active.instructions).toEqual([]);
    });

    it('updates the active path start after moveTo', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 10, y: 15 });

      expect(builder.active.start).toEqual({ x: 10, y: 15 });
      expect(builder.active.instructions).toEqual([]);
    });

    it('updates the active path instructions after lineTo and curveTo', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 20, y: 25 }).lineTo({ x: 30, y: 35 }).curveTo({ x: 40, y: 45 });

      expect(builder.active.start).toEqual({ x: 20, y: 25 });
      expect(builder.active.instructions).toEqual([
        ['L', 30, 35],
        ['T', 40, 45]
      ]);
    });
  });

  describe('pathCount', () => {
    it('returns 1 when no additional paths are added', () => {
      const builder = new PathListBuilder();
      expect(builder.pathCount).toBe(1);
    });

    it('returns 1 after modifying the active path', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 });
      expect(builder.pathCount).toBe(1);
    });

    it('returns 2 after starting a new path', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 });
      builder.moveTo({ x: 20, y: 20 });
      expect(builder.pathCount).toBe(2);
    });

    it('returns the correct count after appending another PathListBuilder', () => {
      const builder1 = new PathListBuilder();
      builder1.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 });

      const builder2 = new PathListBuilder();
      builder2.moveTo({ x: 20, y: 20 }).lineTo({ x: 30, y: 30 });

      builder1.append(builder2);

      expect(builder1.pathCount).toBe(2);
    });
  });

  describe('activeInstructionCount', () => {
    it('returns 0 when no instructions have been added', () => {
      const builder = new PathListBuilder();
      expect(builder.activeInstructionCount).toBe(0);
    });

    it('increases when instructions are added', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 });
      expect(builder.activeInstructionCount).toBe(1);

      builder.curveTo({ x: 20, y: 20 });
      expect(builder.activeInstructionCount).toBe(2);
    });

    it('resets to 0 when starting a new path', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 });
      expect(builder.activeInstructionCount).toBe(1);

      builder.moveTo({ x: 20, y: 20 });
      expect(builder.activeInstructionCount).toBe(0);
    });

    it('decreases when an instruction is popped', () => {
      const builder = new PathListBuilder();
      builder.moveTo({ x: 0, y: 0 }).lineTo({ x: 10, y: 10 }).curveTo({ x: 20, y: 20 });
      expect(builder.activeInstructionCount).toBe(2);

      builder.popInstruction();
      expect(builder.activeInstructionCount).toBe(1);
    });
  });

  describe('withTransform', () => {
    it('scales a path correctly with uniform scaling factors', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 L 10 10 L 20 20`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

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
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

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
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

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
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments).toEqual([
        new CubicSegment({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 40, y: 40 })
      ]);
    });

    it('scales a path with quadratic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 Q 10 10 20 20`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]).toBeInstanceOf(QuadSegment);
      expect(scaledPath.segments[0]!.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]!.end).toEqual({ x: 40, y: 40 });
      expect((scaledPath.segments[0] as QuadSegment).quadP1).toEqual({ x: 20, y: 20 });
    });

    it('scales a path with smooth quadratic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 30, h: 30, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 60, h: 60, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 Q 10 10 20 20 T 30 30`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]).toBeInstanceOf(QuadSegment);
      expect(scaledPath.segments[1]!.start).toEqual({ x: 40, y: 40 });
      expect(scaledPath.segments[1]!.end).toEqual({ x: 60, y: 60 });
    });

    it('scales a path with arc segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 20, h: 20, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 A 10 10 0 0 1 20 20`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      // Arc segments are converted to cubic segments internally
      expect(scaledPath.segments[0]!.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]!.end.x).toBeCloseTo(47.32);
      expect(scaledPath.segments[0]!.end.y).toBeCloseTo(12.679);
    });

    it('scales a path with smooth cubic segments correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 30, h: 30, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: 60, h: 60, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 C 5 5 10 10 15 15 S 25 25 30 30`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments).toHaveLength(2);
      expect(scaledPath.segments[0]).toBeInstanceOf(CubicSegment);
      expect(scaledPath.segments[1]).toBeInstanceOf(CubicSegment);
      expect(scaledPath.segments[0]!.end).toEqual({ x: 30, y: 30 });
      expect(scaledPath.segments[1]!.end).toEqual({ x: 60, y: 60 });
    });

    it('handles zero scaling correctly', () => {
      const fromBounds: Box = { x: 10, y: 10, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 5, y: 5, w: 0, h: 0, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 10 10 L 20 20`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 5, y: 5 });
      expect(scaledPath.segments[0]!.start).toEqual({ x: 5, y: 5 });
      expect(scaledPath.segments[0]!.end).toEqual({ x: 5, y: 5 });
    });

    it('handles negative scaling correctly', () => {
      const fromBounds: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };
      const toBounds: Box = { x: 0, y: 0, w: -10, h: -10, r: 0 };

      const scaledPath = PathListBuilder.fromString(`M 0 0 L 10 10`)
        .withTransform(TransformFactory.fromTo(fromBounds, toBounds))
        .getPaths()
        .singular();

      expect(scaledPath.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]!.start).toEqual({ x: 0, y: 0 });
      expect(scaledPath.segments[0]!.end).toEqual({ x: -10, y: -10 });
    });
  });
});

describe('fromUnitLCS', () => {
  it('transforms from unit coordinate system to box', () => {
    const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };
    const transforms = fromUnitLCS(box);

    // Test transforming a point from unit coordinates to box coordinates
    const unitPoint = { x: 0.5, y: 0.5 };
    const boxPoint = Transform.point(unitPoint, ...transforms);

    // The point (0.5, 0.5) in unit coordinates should map to the center of the box
    expect(boxPoint.x).toBeCloseTo(25);
    expect(boxPoint.y).toBeCloseTo(40);

    // Test transforming corners
    const topLeft = Transform.point({ x: 0, y: 0 }, ...transforms);
    const bottomRight = Transform.point({ x: 1, y: 1 }, ...transforms);

    expect(topLeft.x).toBeCloseTo(10);
    expect(topLeft.y).toBeCloseTo(20);
    expect(bottomRight.x).toBeCloseTo(40);
    expect(bottomRight.y).toBeCloseTo(60);
  });

  it('transforms correctly with rotation', () => {
    const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 90 };
    const transforms = fromUnitLCS(box);
    const unitCenter = { x: 0.5, y: 0.5 };
    const boxCenter = Transform.point(unitCenter, ...transforms);

    // The center should remain at the center regardless of rotation
    expect(boxCenter.x).toBeCloseTo(25);
    expect(boxCenter.y).toBeCloseTo(40);
  });
});

describe('toUnitLCS', () => {
  it('transforms from box to unit coordinate system', () => {
    const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };
    const transforms = toUnitLCS(box);

    // Test transforming a point from box coordinates to unit coordinates
    const boxPoint = { x: 25, y: 40 };
    const unitPoint = Transform.point(boxPoint, ...transforms);

    // The center of the box should map to (0.5, 0.5) in unit coordinates
    expect(unitPoint.x).toBeCloseTo(0.5);
    expect(unitPoint.y).toBeCloseTo(0.5);

    // Test transforming corners
    const topLeft = Transform.point({ x: 10, y: 20 }, ...transforms);
    const bottomRight = Transform.point({ x: 40, y: 60 }, ...transforms);

    expect(topLeft.x).toBeCloseTo(0);
    expect(topLeft.y).toBeCloseTo(0);
    expect(bottomRight.x).toBeCloseTo(1);
    expect(bottomRight.y).toBeCloseTo(1);
  });

  it('transforms correctly with rotation', () => {
    const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 90 };
    const transforms = toUnitLCS(box);

    // The center of the box should map to (0.5, 0.5) in unit coordinates
    const boxCenter = { x: 25, y: 40 };
    const unitCenter = Transform.point(boxCenter, ...transforms);

    expect(unitCenter.x).toBeCloseTo(0.5);
    expect(unitCenter.y).toBeCloseTo(0.5);
  });
});

describe('PathListBuilder.fromString - smooth cubic curves', () => {
  it('parses absolute S command after C command', () => {
    // C command from (0,0) to (10,10) with control points (3,3) and (7,7)
    // S command should reflect (7,7) across (10,10) to get (13,13) as first control point
    const path = PathListBuilder.fromString('M 0 0 C 3 3 7 7 10 10 S 17 17 20 20')
      .getPaths()
      .singular();

    expect(path.segments).toHaveLength(2);
    expect(path.segments[0]).toBeInstanceOf(CubicSegment);
    expect(path.segments[1]).toBeInstanceOf(CubicSegment);

    const cubic1 = path.segments[0] as CubicSegment;
    const cubic2 = path.segments[1] as CubicSegment;

    expect(cubic1.start).toEqual({ x: 0, y: 0 });
    expect(cubic1.p1).toEqual({ x: 3, y: 3 });
    expect(cubic1.p2).toEqual({ x: 7, y: 7 });
    expect(cubic1.end).toEqual({ x: 10, y: 10 });

    expect(cubic2.start).toEqual({ x: 10, y: 10 });
    expect(cubic2.p1).toEqual({ x: 13, y: 13 }); // Reflected: 2*10 - 7 = 13
    expect(cubic2.p2).toEqual({ x: 17, y: 17 });
    expect(cubic2.end).toEqual({ x: 20, y: 20 });
  });

  it('parses relative s command after c command', () => {
    const path = PathListBuilder.fromString('M 0 0 c 3 3 7 7 10 10 s 7 7 10 10')
      .getPaths()
      .singular();

    expect(path.segments).toHaveLength(2);
    const cubic1 = path.segments[0] as CubicSegment;
    const cubic2 = path.segments[1] as CubicSegment;

    expect(cubic1.start).toEqual({ x: 0, y: 0 });
    expect(cubic1.p1).toEqual({ x: 3, y: 3 });
    expect(cubic1.p2).toEqual({ x: 7, y: 7 });
    expect(cubic1.end).toEqual({ x: 10, y: 10 });

    expect(cubic2.start).toEqual({ x: 10, y: 10 });
    expect(cubic2.p1).toEqual({ x: 13, y: 13 }); // Reflected
    expect(cubic2.p2).toEqual({ x: 17, y: 17 }); // 10 + 7
    expect(cubic2.end).toEqual({ x: 20, y: 20 }); // 10 + 10
  });

  it('handles S command without preceding cubic command', () => {
    // When S is not preceded by C or S, first control point should be current point
    const path = PathListBuilder.fromString('M 0 0 L 10 10 S 15 15 20 20')
      .getPaths()
      .singular();

    expect(path.segments).toHaveLength(2);
    expect(path.segments[1]).toBeInstanceOf(CubicSegment);

    const cubic = path.segments[1] as CubicSegment;
    expect(cubic.start).toEqual({ x: 10, y: 10 });
    expect(cubic.p1).toEqual({ x: 10, y: 10 }); // Same as start point
    expect(cubic.p2).toEqual({ x: 15, y: 15 });
    expect(cubic.end).toEqual({ x: 20, y: 20 });
  });

  it('handles chained S commands', () => {
    const path = PathListBuilder.fromString('M 0 0 C 2 2 4 4 6 6 S 10 10 12 12 S 16 16 18 18')
      .getPaths()
      .singular();

    expect(path.segments).toHaveLength(3);

    const cubic1 = path.segments[0] as CubicSegment;
    const cubic2 = path.segments[1] as CubicSegment;
    const cubic3 = path.segments[2] as CubicSegment;

    // First cubic
    expect(cubic1.p2).toEqual({ x: 4, y: 4 });
    expect(cubic1.end).toEqual({ x: 6, y: 6 });

    // Second cubic - reflects (4,4) across (6,6) to get (8,8)
    expect(cubic2.p1).toEqual({ x: 8, y: 8 });
    expect(cubic2.p2).toEqual({ x: 10, y: 10 });
    expect(cubic2.end).toEqual({ x: 12, y: 12 });

    // Third cubic - reflects (10,10) across (12,12) to get (14,14)
    expect(cubic3.p1).toEqual({ x: 14, y: 14 });
    expect(cubic3.p2).toEqual({ x: 16, y: 16 });
    expect(cubic3.end).toEqual({ x: 18, y: 18 });
  });
});
