import { describe, expect, test } from 'vitest';
import { type Anchor, getClosestAnchor, makeAnchorId } from './anchor';
import type { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';

describe('makeAnchorId', () => {
  test('should create ID from point coordinates rounded to 1000ths', () => {
    const point = { x: 0.5, y: 0.5 };
    expect(makeAnchorId(point)).toBe('500_500');
  });

  test('should round coordinates correctly', () => {
    const point = { x: 0.12345, y: 0.67899 };
    expect(makeAnchorId(point)).toBe('123_679');
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

    test('should find anchor at top-left corner', () => {
      const anchors: Anchor[] = [
        { id: 'tl', type: 'point', start: { x: 0, y: 0 } },
        { id: 'br', type: 'point', start: { x: 1, y: 1 } }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 5, y: 5 }, node, false);

      expect(result?.anchor?.id).toBe('tl');
      expect(result?.point).toEqual({ x: 0, y: 0 });
    });

    test('should work with nodes at different positions', () => {
      const anchors: Anchor[] = [{ id: '1', type: 'point', start: { x: 0.5, y: 0.5 } }];
      const node = createMockNode(anchors, { x: 200, y: 200, w: 100, h: 100, r: 0 });
      const result = getClosestAnchor({ x: 250, y: 250 }, node, false);

      expect(result?.anchor?.id).toBe('1');
      expect(result?.point).toEqual({ x: 250, y: 250 });
    });

    test('should work with different sized nodes', () => {
      const anchors: Anchor[] = [{ id: '1', type: 'point', start: { x: 0.5, y: 0.5 } }];
      const node = createMockNode(anchors, { x: 0, y: 0, w: 200, h: 50, r: 0 });
      const result = getClosestAnchor({ x: 100, y: 25 }, node, false);

      expect(result?.anchor?.id).toBe('1');
      expect(result?.point).toEqual({ x: 100, y: 25 });
    });
  });

  describe('edge anchors', () => {
    test('should handle edge anchors correctly', () => {
      const anchors: Anchor[] = [
        {
          id: 'edge1',
          type: 'edge',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 }
        }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 50, y: 50 }, node, false);

      expect(result).toBeDefined();
      expect(result?.anchor?.id).toBe('edge1');
    });

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
      // Point above the edge should still find the edge as closest
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

    test('should handle vertical edge anchor', () => {
      const anchors: Anchor[] = [
        {
          id: 'vedge',
          type: 'edge',
          start: { x: 0.5, y: 0 },
          end: { x: 0.5, y: 1 }
        }
      ];
      const node = createMockNode(anchors);
      const result = getClosestAnchor({ x: 50, y: 50 }, node, false);

      expect(result?.anchor?.id).toBe('vedge');
    });
  });
});
