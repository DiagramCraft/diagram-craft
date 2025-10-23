import { describe, expect, test } from 'vitest';
import { _test, type Anchor, AnchorStrategy, getClosestAnchor } from './anchor';
import type { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { PathList } from '@diagram-craft/geometry/pathList';
import { Path } from '@diagram-craft/geometry/path';

describe('makeAnchorId', () => {
  test('should create ID from point coordinates rounded to 1000ths', () => {
    const point = { x: 0.5, y: 0.5 };
    expect(_test.makeAnchorId(point)).toBe('500_500');
  });

  test('should round coordinates correctly', () => {
    const point = { x: 0.12345, y: 0.67899 };
    expect(_test.makeAnchorId(point)).toBe('123_679');
  });
});

describe('getClosestAnchor', () => {
  const createMockNode = (
    anchors: Anchor[],
    bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 },
    supportsBoundary = false
  ): DiagramNode => {
    return {
      anchors,
      bounds,
      _getPositionInBounds: (p: Point) => {
        return {
          x: bounds.x + p.x * bounds.w,
          y: bounds.y + p.y * bounds.h
        };
      },
      getDefinition: () => ({
        supports: (capability: string) => capability === 'connect-to-boundary' && supportsBoundary,
        getBoundingPath: () => ({
          all: () => []
        })
      })
    } as unknown as DiagramNode;
  };

  describe('point anchors', () => {
    test('should return undefined when no anchors exist', () => {
      const node = createMockNode([]);
      const result = getClosestAnchor({ x: 50, y: 50 }, node, false);
      expect(result).toBeUndefined();
    });

    test('should return closest point anchor', () => {
      const anchors: Anchor[] = [
        { id: '1', type: 'point', start: { x: 0, y: 0 } },
        { id: '2', type: 'point', start: { x: 1, y: 1 } },
        { id: '3', type: 'point', start: { x: 0.5, y: 0.5 } }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 55, y: 55 }, node, false);

      expect(result).toBeDefined();
      expect(result?.anchor?.id).toBe('3');
      expect(result?.point).toEqual({ x: 50, y: 50 });
    });
  });

  describe('edge anchors', () => {
    test('should project point onto edge anchor', () => {
      const anchors: Anchor[] = [
        {
          id: 'edge1',
          type: 'edge',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 }
        }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 50, y: 10 }, node, false);

      expect(result?.anchor?.id).toBe('edge1');
    });

    test('should choose edge over point when edge is closer', () => {
      const anchors: Anchor[] = [
        { id: 'point1', type: 'point', start: { x: 0, y: 0 } },
        {
          id: 'edge1',
          type: 'edge',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 }
        }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 50, y: 45 }, node, false);

      expect(result?.anchor?.id).toBe('edge1');
    });
  });
});

describe('AnchorStrategy', () => {
  const createMockNode = (bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 }): DiagramNode => {
    return {
      bounds,
      _getPositionInBounds: (p: Point) => {
        return {
          x: bounds.x + p.x * bounds.w,
          y: bounds.y + p.y * bounds.h
        };
      }
    } as unknown as DiagramNode;
  };

  describe('getAnchorsByDirection', () => {
    test('should create directional anchors with center and primary directions', () => {
      const node = createMockNode();
      const rectPath = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const paths = new PathList([rectPath]);

      const anchors = AnchorStrategy.getAnchorsByDirection(node, paths, 4);

      expect(anchors.length).toBeGreaterThanOrEqual(5);
      expect(anchors.find(a => a.id === 'c')).toBeDefined();
      expect(anchors.filter(a => a.isPrimary).length).toBe(4);
    });

    test('should create more anchors with higher numberOfDirections', () => {
      const node = createMockNode();
      const rectPath = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const paths = new PathList([rectPath]);

      const anchors4 = AnchorStrategy.getAnchorsByDirection(node, paths, 4);
      const anchors8 = AnchorStrategy.getAnchorsByDirection(node, paths, 8);

      expect(anchors8.length).toBeGreaterThan(anchors4.length);
    });
  });

  describe('getEdgeAnchors', () => {
    test('should create anchors per edge', () => {
      const node = createMockNode();
      const rectPath = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const paths = new PathList([rectPath]);

      const anchors = AnchorStrategy.getEdgeAnchors(node, paths, 1);

      expect(anchors.length).toBeGreaterThanOrEqual(5);
      expect(anchors.find(a => a.id === 'c')).toBeDefined();
    });

    test('should create multiple anchors per edge when specified', () => {
      const node = createMockNode();
      const rectPath = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const paths = new PathList([rectPath]);

      const anchors1 = AnchorStrategy.getEdgeAnchors(node, paths, 1);
      const anchors2 = AnchorStrategy.getEdgeAnchors(node, paths, 2);

      expect(anchors2.length).toBeGreaterThan(anchors1.length);
    });
  });

  describe('getPathAnchors', () => {
    test('should create specified number of anchors along path', () => {
      const node = createMockNode();
      const path = new Path({ x: 0, y: 0 }, [
        ['L', 100, 0],
        ['L', 100, 100],
        ['L', 0, 100],
        ['L', 0, 0]
      ]);
      const paths = new PathList([path]);

      const anchors = AnchorStrategy.getPathAnchors(node, paths, 5);

      const pointAnchors = anchors.filter(a => a.type === 'point');
      expect(pointAnchors.length).toBe(5);
      expect(anchors.find(a => a.id === 'c')).toBeDefined();
    });

    test('should distribute anchors evenly along path', () => {
      const node = createMockNode();
      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const paths = new PathList([path]);

      const anchors = AnchorStrategy.getPathAnchors(node, paths, 3);

      const pointAnchors = anchors.filter(a => a.type === 'point');
      const positions = pointAnchors.map(a => a.start.x).sort((a, b) => a - b);
      expect(positions[0]).toBeLessThan(positions[1]!);
      expect(positions[1]).toBeLessThan(positions[2]!);
    });
  });
});

describe('toNormalizedCoords', () => {
  test('should convert points to normalized coordinates', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

    expect(_test.toNormalizedCoords(Point.of(50, 50), bounds)).toEqual({ x: 0.5, y: 0.5 });
    expect(_test.toNormalizedCoords(Point.of(0, 0), bounds)).toEqual({ x: 0, y: 0 });
    expect(_test.toNormalizedCoords(Point.of(100, 100), bounds)).toEqual({ x: 1, y: 1 });
  });

  test('should handle non-zero origin and different dimensions', () => {
    const bounds = { x: 100, y: 100, w: 200, h: 100, r: 0 };

    expect(_test.toNormalizedCoords(Point.of(200, 150), bounds)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('adjustNormalDirection', () => {
  test('should handle different boundary directions', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const point = Point.of(75, 25);
    const baseNormal = Math.PI / 4;

    expect(_test.adjustNormalDirection(baseNormal, 'counter-clockwise', bounds, point)).toBe(
      baseNormal
    );
    expect(_test.adjustNormalDirection(baseNormal, 'clockwise', bounds, point)).toBe(
      baseNormal + Math.PI
    );
  });

  test('should ensure normal points outward for unknown direction', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const point = Point.of(100, 50);

    // Normal already pointing outward should stay
    expect(_test.adjustNormalDirection(0, 'unknown', bounds, point)).toBe(0);

    // Normal pointing inward should flip
    expect(_test.adjustNormalDirection(Math.PI, 'unknown', bounds, point)).toBe(Math.PI + Math.PI);
  });
});
