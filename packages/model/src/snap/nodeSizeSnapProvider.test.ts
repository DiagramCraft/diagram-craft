import { describe, expect, test } from 'vitest';
import { NodeSizeSnapProvider } from './nodeSizeSnapProvider';
import { TestModel } from '../test-support/builder';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import type { MatchingMagnetPair } from './snapManager';

describe('NodeSizeSnapProvider', () => {
  describe('getMagnets', () => {
    describe('getMagnets - basic functionality', () => {
      test('should return empty array when no nodes exist', () => {
        const { diagram } = TestModel.newDiagramWithLayer();
        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 10, y: 10, w: 50, h: 30, r: 0 };

        const magnets = provider.getMagnets(testBox);

        expect(magnets).toEqual([]);
      });

      test('should create size magnets for node with height to match', () => {
        // Create a node with different height than test box
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 100, y: 20, w: 60, h: 80, r: 0 } } // Node with height 80, positioned to the north
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 50, y: 120, w: 50, h: 30, r: 0 }; // Current height 30, should match to 80

        const magnets = provider.getMagnets(testBox);

        // Should create magnets for height matching
        const sizeMagnets = magnets.filter(m => m.type === 'size');
        expect(sizeMagnets.length).toBeGreaterThan(0);

        // Check that the size is the target node's height
        const heightMagnets = sizeMagnets.filter(m => m.axis === 'h');
        expect(heightMagnets.length).toBe(2); // Forward and backward magnets

        heightMagnets.forEach(magnet => {
          expect(magnet.size).toBe(80); // Target height from the node
          expect(magnet.node.bounds.h).toBe(80);
          expect(magnet.respectDirection).toBe(false);
        });
      });

      test('should create size magnets for node with width to match', () => {
        // Create a node with different width than test box
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 20, y: 100, w: 120, h: 40, r: 0 } } // Node with width 120, positioned to the west
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 200, y: 110, w: 50, h: 30, r: 0 }; // Current width 50, should match to 120

        const magnets = provider.getMagnets(testBox);

        // Should create magnets for width matching
        const sizeMagnets = magnets.filter(m => m.type === 'size');
        expect(sizeMagnets.length).toBeGreaterThan(0);

        // Check that the size is the target node's width
        const widthMagnets = sizeMagnets.filter(m => m.axis === 'v');
        expect(widthMagnets.length).toBe(2); // Forward and backward magnets

        widthMagnets.forEach(magnet => {
          expect(magnet.size).toBe(120); // Target width from the node
          expect(magnet.node.bounds.w).toBe(120);
          expect(magnet.respectDirection).toBe(false);
        });
      });
    });

    describe('getMagnets - directional behavior', () => {
      test('should select closest node by center distance in each direction', () => {
        // Create multiple nodes in the same direction with different distances
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 10, w: 40, h: 100, r: 0 } }, // North direction, height 100
            { bounds: { x: 200, y: 10, w: 40, h: 150, r: 0 } }, // East direction, width 40
            { bounds: { x: 300, y: 10, w: 40, h: 200, r: 0 } } // East direction, width 40 (further)
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 60, y: 200, w: 30, h: 50, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        expect(sizeMagnets.length).toBe(4); // 2 for height + 2 for width

        // Height magnets should reference the north node with height 100
        const heightMagnets = sizeMagnets.filter(m => m.axis === 'h');
        expect(heightMagnets.length).toBe(2);
        heightMagnets.forEach(magnet => {
          expect(magnet.size).toBe(100); // Height of the north node
        });

        // Width magnets should reference the closest east node with width 40
        const widthMagnets = sizeMagnets.filter(m => m.axis === 'v');
        expect(widthMagnets.length).toBe(2);
        widthMagnets.forEach(magnet => {
          expect(magnet.size).toBe(40); // Width of the east nodes
        });
      });

      test('should create both forward and backward magnets', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 20, y: 20, w: 60, h: 80, r: 0 } }]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 30, y: 150, w: 40, h: 50, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        expect(sizeMagnets.length).toBe(2); // Should have forward and backward magnets

        // Check that we have different match directions
        const directions = sizeMagnets.map(m => m.matchDirection);
        expect(directions.length).toBe(2);
      });

      test('should handle multiple directions with different target sizes', () => {
        // Create nodes in different directions with different dimensions
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 10, w: 40, h: 100, r: 0 } }, // North: height 100
            { bounds: { x: 50, y: 200, w: 40, h: 120, r: 0 } }, // South: height 120
            { bounds: { x: 10, y: 110, w: 80, h: 30, r: 0 } }, // West: width 80
            { bounds: { x: 200, y: 110, w: 90, h: 30, r: 0 } } // East: width 90
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 60, y: 120, w: 50, h: 40, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        // Should have magnets for 3 directions: north (100), south (120), east (90)
        // West node doesn't have range overlap, so no west magnets
        expect(sizeMagnets.length).toBe(6);

        // Check that we have the expected dimensions
        const heightMagnets = sizeMagnets.filter(m => m.axis === 'h');
        const widthMagnets = sizeMagnets.filter(m => m.axis === 'v');

        expect(heightMagnets.length).toBe(4); // North (2) and South (2)
        expect(widthMagnets.length).toBe(2); // East only (2)

        // Heights should be from north (100) and south (120) nodes
        const heightSizes = [...new Set(heightMagnets.map(m => m.size))].sort();
        expect(heightSizes).toEqual([100, 120]);

        // Width should be from east (90) node only
        const widthSizes = [...new Set(widthMagnets.map(m => m.size))];
        expect(widthSizes).toEqual([90]);
      });
    });

    describe('getMagnets - filtering behavior', () => {
      test('should filter out intersecting nodes', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 40, y: 40, w: 60, h: 80, r: 0 } }, // Intersects with test box
            { bounds: { x: 200, y: 40, w: 60, h: 100, r: 0 } } // Doesn't intersect
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 50, y: 50, w: 40, h: 60, r: 0 }; // Overlaps with first node

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        // Should only use the non-intersecting node
        expect(sizeMagnets.length).toBe(2); // Should have 2 width magnets

        sizeMagnets.forEach(magnet => {
          expect(magnet.size).toBe(60); // Width of the non-intersecting node
          expect(magnet.axis).toBe('v'); // Only width magnets should be generated
          expect(magnet.node.bounds.x).toBe(200); // X position of the non-intersecting node
        });
      });

      test('should respect eligibleNodePredicate', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 20, y: 20, w: 60, h: 80, r: 0 }, id: 'excluded' },
            { bounds: { x: 200, y: 20, w: 60, h: 100, r: 0 }, id: 'included' }
          ]
        });

        // Predicate that excludes the first node
        const provider = new NodeSizeSnapProvider(diagram, id => id !== 'excluded');
        const testBox = { x: 50, y: 150, w: 40, h: 50, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        // Should only use the included node
        sizeMagnets.forEach(magnet => {
          expect(magnet.size).toBe(100); // Height of the included node
          expect(magnet.node.id).toBe('included');
        });
      });

      test('should skip directions with no viable nodes', () => {
        // Create node only in one direction
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 20, y: 20, w: 60, h: 80, r: 0 } } // Only north of test box
          ]
        });

        const provider = new NodeSizeSnapProvider(diagram, () => true);
        const testBox = { x: 30, y: 150, w: 40, h: 50, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const sizeMagnets = magnets.filter(m => m.type === 'size');

        // Should only have magnets for the north direction (2 magnets: forward + backward)
        expect(sizeMagnets.length).toBe(2);
        sizeMagnets.forEach(magnet => {
          expect(magnet.size).toBe(80); // Height from the north node
        });
      });
    });
  });

  describe('highlight', () => {
    test('should create highlight with distance pairs for height matching', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 50, y: 20, w: 40, h: 80, r: 0 } }]
      });

      const provider = new NodeSizeSnapProvider(diagram, () => true);
      const testBox = { x: 60, y: 150, w: 30, h: 50, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const sizeMagnet = magnets.find(m => m.type === 'size' && m.axis === 'h')!;

      // Create a matching pair
      const sourceMagnet = {
        line: Line.horizontal(200, [60, 90]), // Horizontal line for height matching
        axis: Axis.h,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'size'> = {
        self: sourceMagnet,
        matching: sizeMagnet,
        distance: 0
      };

      // Act
      const highlight = provider.highlight(testBox, matchingPair, Axis.h);

      // Verify
      expect(highlight).toBeDefined();
      expect(highlight.line).toBe(sizeMagnet.line);
      expect(highlight.matchingMagnet).toBe(sizeMagnet);
      expect(highlight.selfMagnet).toBe(sourceMagnet);

      // Should have added distance pairs for both current box and reference node
      expect(sizeMagnet.distancePairs).toHaveLength(2);

      // Check distance pairs
      const currentBoxPair = sizeMagnet.distancePairs[0];
      const referenceNodePair = sizeMagnet.distancePairs[1];

      expect(currentBoxPair.distance).toBe(80); // Target size
      expect(referenceNodePair.distance).toBe(80);

      // Points should be at the midpoints of north and south edges
      expect(currentBoxPair.pointA.x).toBe(75); // Midpoint of test box top edge
      expect(currentBoxPair.pointB.x).toBe(75); // Midpoint of test box bottom edge
      expect(currentBoxPair.pointA.y).toBe(150); // Test box top
      expect(currentBoxPair.pointB.y).toBe(200); // Test box bottom
    });

    test('should create highlight with distance pairs for width matching', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 20, y: 50, w: 100, h: 40, r: 0 } }]
      });

      const provider = new NodeSizeSnapProvider(diagram, () => true);
      const testBox = { x: 200, y: 60, w: 60, h: 30, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const sizeMagnet = magnets.find(m => m.type === 'size' && m.axis === 'v')!;

      // Create a matching pair
      const sourceMagnet = {
        line: Line.vertical(230, [60, 90]), // Vertical line for width matching
        axis: Axis.v,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'size'> = {
        self: sourceMagnet,
        matching: sizeMagnet,
        distance: 0
      };

      // Act
      provider.highlight(testBox, matchingPair, Axis.v);

      // Verify distance pairs for width matching
      expect(sizeMagnet.distancePairs).toHaveLength(2);

      const currentBoxPair = sizeMagnet.distancePairs[0];
      const referenceNodePair = sizeMagnet.distancePairs[1];

      expect(currentBoxPair.distance).toBe(100); // Target width
      expect(referenceNodePair.distance).toBe(100);

      // Points should be at the midpoints of east and west edges
      expect(currentBoxPair.pointA.y).toBe(75); // Midpoint of test box right edge
      expect(currentBoxPair.pointB.y).toBe(75); // Midpoint of test box left edge
      expect(currentBoxPair.pointA.x).toBe(260); // Test box right
      expect(currentBoxPair.pointB.x).toBe(200); // Test box left
    });

    test('should populate highlight with correct reference node measurements', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 30, y: 10, w: 50, h: 90, r: 0 } }]
      });

      const provider = new NodeSizeSnapProvider(diagram, () => true);
      const testBox = { x: 40, y: 150, w: 40, h: 60, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const sizeMagnet = magnets.find(m => m.type === 'size' && m.axis === 'h')!;

      const sourceMagnet = {
        line: Line.horizontal(210, [40, 80]),
        axis: Axis.h,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'size'> = {
        self: sourceMagnet,
        matching: sizeMagnet,
        distance: 0
      };

      provider.highlight(testBox, matchingPair, Axis.h);

      // Check reference node distance pair
      const referenceNodePair = sizeMagnet.distancePairs[1];

      expect(referenceNodePair.pointA.x).toBe(55); // Midpoint of reference node top edge (30 + 50/2)
      expect(referenceNodePair.pointB.x).toBe(55); // Midpoint of reference node bottom edge
      expect(referenceNodePair.pointA.y).toBe(10); // Reference node top
      expect(referenceNodePair.pointB.y).toBe(100); // Reference node bottom (10 + 90)
    });
  });
});
