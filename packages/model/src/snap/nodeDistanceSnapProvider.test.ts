import { describe, expect, test } from 'vitest';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider';
import { TestModel } from '../test-support/builder';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import type { MatchingMagnetPair } from './snapManager';

const createDiagramWithNodes = (
  nodePositions: Array<{ x: number; y: number; w: number; h: number; id?: string }>
) => {
  const diagram = TestModel.newDiagram();
  const layer = diagram.newLayer();

  nodePositions.forEach((pos, index) => {
    layer.addNode(pos.id ?? `node${index + 1}`, 'rect', {
      bounds: {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        r: 0
      }
    });
  });

  return { diagram, layer };
};

describe('NodeDistanceSnapProvider', () => {
  describe('constructor', () => {
    test('should create provider with diagram and predicate', () => {
      const { diagram } = createDiagramWithNodes([]);
      const provider = new NodeDistanceSnapProvider(diagram, () => true);

      expect(provider).toBeDefined();
    });
  });

  describe('getMagnets - horizontal distance patterns', () => {
    test('should create distance magnets for horizontally aligned nodes', () => {
      // Create two nodes aligned horizontally with a 50px gap
      // Node1: (10, 20, 30x20) -> right edge at x=40
      // Node2: (90, 20, 30x20) -> left edge at x=90
      // Gap: 90 - 40 = 50px
      const { diagram } = createDiagramWithNodes([
        { x: 10, y: 20, w: 30, h: 20 }, // Node1
        { x: 90, y: 20, w: 30, h: 20 } // Node2
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);

      // Test box positioned to the left, not intersecting with any nodes
      const testBox = { x: -30, y: 20, w: 20, h: 20, r: 0 }; // x: -30 to -10, no intersection

      const magnets = provider.getMagnets(testBox);

      // Should have distance magnets
      const distanceMagnets = magnets.filter(m => m.type === 'distance');
      expect(distanceMagnets.length).toBeGreaterThan(0);

      // Check for east-direction magnet (test box is west of nodes, so creates east magnets)
      const eastMagnets = distanceMagnets.filter(m => m.matchDirection === 'e');
      expect(eastMagnets.length).toBe(1);

      const eastMagnet = eastMagnets[0];
      expect(eastMagnet.line.from.x).toBe(-40); // 10 - 50 = -40
      expect(eastMagnet.distancePairs).toHaveLength(1);
      expect(eastMagnet.distancePairs[0].distance).toBe(50);
    });

    test('should skip nodes without overlapping vertical ranges', () => {
      // Two nodes not vertically aligned - no horizontal distance magnets should be created
      const { diagram } = createDiagramWithNodes([
        { x: 10, y: 10, w: 20, h: 20 }, // y: 10-30
        { x: 50, y: 50, w: 20, h: 20 } // y: 50-70 (no overlap)
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 0, y: 15, w: 15, h: 10, r: 0 }; // y: 15-25

      const magnets = provider.getMagnets(testBox);

      // Should not have any distance magnets because nodes don't align
      expect(magnets).toHaveLength(0);
    });
  });

  describe('getMagnets - vertical distance patterns', () => {
    test('should create distance magnets for vertically aligned nodes', () => {
      // Two nodes aligned vertically with a 40px gap
      const { diagram } = createDiagramWithNodes([
        { x: 30, y: 10, w: 25, h: 20 }, // Node1: bottom at y=30
        { x: 30, y: 70, w: 25, h: 20 } // Node2: top at y=70, gap = 40
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);

      // Test box positioned above Node1, not intersecting
      const testBox = { x: 30, y: -35, w: 25, h: 15, r: 0 }; // y: -35 to -20, no intersection

      const magnets = provider.getMagnets(testBox);

      // Should have south-direction magnet (test box is north of nodes, so creates south magnets)
      const southMagnets = magnets.filter(m => m.matchDirection === 's');
      expect(southMagnets.length).toBe(1);

      const southMagnet = southMagnets[0];
      expect(southMagnet.line.from.y).toBe(-30); // 10 - 40 = -30
      expect(southMagnet.distancePairs[0].distance).toBe(40);
    });
  });

  describe('getMagnets - complex scenarios', () => {
    test('should filter out nodes that intersect with test box', () => {
      const { diagram } = createDiagramWithNodes([
        { x: 10, y: 20, w: 20, h: 20 },
        { x: 50, y: 20, w: 20, h: 20 }
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);

      // Test box that overlaps with the first node
      const testBox = { x: 25, y: 20, w: 20, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);

      // Should not create magnets because one node intersects with test box
      expect(magnets).toHaveLength(0);
    });

    test('should respect eligibleNodePredicate', () => {
      const { diagram } = createDiagramWithNodes([
        { x: 10, y: 30, w: 20, h: 20, id: 'node1' },
        { x: 50, y: 30, w: 20, h: 20, id: 'node2' }
      ]);

      // Predicate that excludes node2
      const provider = new NodeDistanceSnapProvider(diagram, id => id !== 'node2');
      const testBox = { x: 0, y: 30, w: 15, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);

      // Should not create distance magnets because one node is excluded
      expect(magnets).toHaveLength(0);
    });

    test('should avoid duplicate magnets at same position', () => {
      // Create scenario where multiple distance calculations might result in same position
      const { diagram } = createDiagramWithNodes([
        { x: 10, y: 20, w: 20, h: 15 }, // Pattern 1
        { x: 40, y: 20, w: 20, h: 15 }, // 20px gap
        { x: 10, y: 40, w: 20, h: 15 }, // Pattern 2
        { x: 40, y: 40, w: 20, h: 15 } // Same 20px gap
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 0, y: 25, w: 15, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);

      const eastMagnets = magnets.filter(m => m.matchDirection === 'e');

      // Should only have one magnet at x = -10 (10 - 20), not duplicates
      const uniquePositions = new Set(eastMagnets.map(m => m.line.from.x));
      expect(uniquePositions.size).toBe(eastMagnets.length);
    });
  });

  describe('highlight', () => {
    test('should create highlight with updated distance pairs', () => {
      const { diagram } = createDiagramWithNodes([
        { x: 20, y: 40, w: 20, h: 20 },
        { x: 70, y: 40, w: 20, h: 20 }
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 0, y: 40, w: 15, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const distanceMagnet = magnets.find(m => m.type === 'distance')!;

      // Create a matching pair
      const sourceMagnet = {
        line: Line.vertical(7.5, Range.of(40, 60)), // Center of test box
        axis: Axis.v,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'distance'> = {
        self: sourceMagnet,
        matching: distanceMagnet,
        distance: 0
      };

      // Act
      const highlight = provider.highlight(testBox, matchingPair, Axis.v);

      // Verify
      expect(highlight).toBeDefined();
      expect(highlight!.line).toBe(sourceMagnet.line);
      expect(highlight!.matchingMagnet).toBe(distanceMagnet);
      expect(highlight!.selfMagnet).toBe(sourceMagnet);

      // Should have added a new distance pair
      expect(distanceMagnet.distancePairs).toHaveLength(2);

      // New distance pair should have the same distance as original
      const newPair = distanceMagnet.distancePairs[1];
      expect(newPair.distance).toBe(distanceMagnet.distancePairs[0].distance);
    });

    test('should update distance pair points for visual alignment', () => {
      const { diagram } = createDiagramWithNodes([
        { x: 30, y: 25, w: 20, h: 30 }, // Vertical range: 25-55
        { x: 30, y: 70, w: 20, h: 30 } // Vertical range: 70-100
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 30, y: 0, w: 20, h: 20, r: 0 }; // Range: 0-20

      const magnets = provider.getMagnets(testBox);
      const distanceMagnet = magnets.find(m => m.type === 'distance')!;

      const sourceMagnet = {
        line: Line.horizontal(10, Range.of(30, 50)), // Test box center
        axis: Axis.h,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'distance'> = {
        self: sourceMagnet,
        matching: distanceMagnet,
        distance: 0
      };

      // Act
      const highlight = provider.highlight(testBox, matchingPair, Axis.h);

      // Verify distance pairs have been updated with intersection midpoint
      expect(highlight).toBeDefined();

      // All distance pairs should have their points aligned to the intersection midpoint
      const intersection = Range.intersection(
        Range.intersection(
          distanceMagnet.distancePairs[0].rangeA,
          distanceMagnet.distancePairs[0].rangeB
        )!,
        Range.of(30, 50) // testBox horizontal range
      );

      if (intersection) {
        const expectedMidpoint = Range.midpoint(intersection);

        distanceMagnet.distancePairs.forEach(dp => {
          expect(dp.pointA.x).toBe(expectedMidpoint);
          expect(dp.pointB.x).toBe(expectedMidpoint);
        });
      }
    });
  });

  describe('distance pair accuracy', () => {
    test('should create accurate distance pairs with correct points', () => {
      // Precise test for distance pair point calculations
      const { diagram } = createDiagramWithNodes([
        { x: 100, y: 200, w: 50, h: 40 }, // Node1: 100-150 x 200-240
        { x: 200, y: 200, w: 50, h: 40 } // Node2: 200-250 x 200-240, gap = 50px
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 0, y: 210, w: 30, h: 20, r: 0 }; // 0-30 x 210-230

      const magnets = provider.getMagnets(testBox);
      const eastMagnet = magnets.find(m => m.matchDirection === 'e')!;

      expect(eastMagnet).toBeDefined();
      expect(eastMagnet.distancePairs).toHaveLength(1);

      const dp = eastMagnet.distancePairs[0];
      expect(dp.distance).toBe(50);

      // Points should be at the intersection midpoint of overlapping ranges
      const intersectionRange = Range.intersection(
        Range.of(200, 240), // Node vertical range
        Range.of(210, 230) // Test box vertical range
      );
      const midpoint = Range.midpoint(intersectionRange!);
      expect(midpoint).toBe(220);

      // Point A should be at Node1's right edge
      expect(dp.pointA.x).toBe(150);
      expect(dp.pointA.y).toBe(220);

      // Point B should be at Node2's left edge
      expect(dp.pointB.x).toBe(200);
      expect(dp.pointB.y).toBe(220);
    });
  });

  describe('magnet line positioning', () => {
    test('should position magnet lines correctly with proper ranges', () => {
      const { diagram } = createDiagramWithNodes([
        { x: 50, y: 100, w: 40, h: 60 }, // 50-90 x 100-160
        { x: 130, y: 120, w: 40, h: 60 } // 130-170 x 120-180
      ]);

      const provider = new NodeDistanceSnapProvider(diagram, () => true);
      const testBox = { x: 0, y: 110, w: 30, h: 40, r: 0 }; // 0-30 x 110-150

      const magnets = provider.getMagnets(testBox);
      const eastMagnet = magnets.find(m => m.matchDirection === 'e')!;

      // Distance between nodes: 130 - 90 = 40px
      // Magnet should be positioned at: 50 - 40 = 10
      expect(eastMagnet.line.from.x).toBe(10);

      // Magnet line range should be intersection of Node1 range and test box range
      const expectedRange = Range.intersection(
        Range.of(100, 160), // Node1 vertical range
        Range.of(110, 150) // Test box vertical range
      );

      expect(eastMagnet.line.from.y).toBe(expectedRange![0]);
      expect(eastMagnet.line.to.y).toBe(expectedRange![1]);
    });
  });
});
