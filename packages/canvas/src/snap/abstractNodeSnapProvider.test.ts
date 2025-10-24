import { describe, expect, test } from 'vitest';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Box } from '@diagram-craft/geometry/box';
import { Direction } from '@diagram-craft/geometry/direction';
import { Axis } from '@diagram-craft/geometry/axis';
import type { EligibleNodePredicate } from './snapManager';
import type { Diagram } from '@diagram-craft/model/diagram';

/**
 * Minimal concrete implementation of AbstractNodeSnapProvider for testing
 * This dummy implementation exposes the protected methods as public for testing
 */
class TestNodeSnapProvider extends AbstractNodeSnapProvider {
  constructor(diagram: Diagram, eligibleNodePredicate: EligibleNodePredicate) {
    super(diagram, eligibleNodePredicate);
  }

  // Expose protected methods for testing
  public testGetEdgePosition(b: Box, dir: Direction) {
    return this.getEdgePosition(b, dir);
  }

  public testGetRange(b: Box, axis: Axis) {
    return this.getRange(b, axis);
  }

  public testGetViableNodes(box: Box) {
    return this.getViableNodes(box);
  }
}

describe('AbstractNodeSnapProvider', () => {
  describe('getEdgePosition', () => {
    test('should return correct edge position for north direction', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };

      const northEdge = provider.testGetEdgePosition(box, 'n');
      expect(northEdge).toBe(20); // Top edge (y coordinate)
    });

    test('should return correct edge position for south direction', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };

      const southEdge = provider.testGetEdgePosition(box, 's');
      expect(southEdge).toBe(60); // Bottom edge (y + height)
    });

    test('should return correct edge position for west direction', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };

      const westEdge = provider.testGetEdgePosition(box, 'w');
      expect(westEdge).toBe(10); // Left edge (x coordinate)
    });

    test('should return correct edge position for east direction', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };

      const eastEdge = provider.testGetEdgePosition(box, 'e');
      expect(eastEdge).toBe(40); // Right edge (x + width)
    });
  });

  describe('getRange', () => {
    test('should return correct horizontal range', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 15, y: 25, w: 50, h: 30, r: 0 };

      const hRange = provider.testGetRange(box, 'h');
      expect(hRange[0]).toBe(15); // Left edge
      expect(hRange[1]).toBe(65); // Right edge (15 + 50)
    });

    test('should return correct vertical range', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const box: Box = { x: 15, y: 25, w: 50, h: 30, r: 0 };

      const vRange = provider.testGetRange(box, 'v');
      expect(vRange[0]).toBe(25); // Top edge
      expect(vRange[1]).toBe(55); // Bottom edge (25 + 30)
    });
  });

  describe('getViableNodes', () => {
    test('should return empty arrays when no nodes exist', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 0, y: 0, w: 10, h: 10, r: 0 };

      const result = provider.testGetViableNodes(testBox);

      expect(result.n).toEqual([]);
      expect(result.s).toEqual([]);
      expect(result.e).toEqual([]);
      expect(result.w).toEqual([]);
    });

    test('should categorize nodes in north direction', () => {
      // Node above test box
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 20, y: 10, w: 30, h: 20, r: 0 } } // Node: bottom edge at y=30, test box starts at y=50
        ]
      });

      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 25, y: 50, w: 20, h: 15, r: 0 }; // y: 50-65, overlaps horizontally

      const result = provider.testGetViableNodes(testBox);

      expect(result.n).toHaveLength(1);
      expect(result.s).toHaveLength(0);
      expect(result.e).toHaveLength(0);
      expect(result.w).toHaveLength(0);
    });

    test('should filter out intersecting nodes', () => {
      // Node that overlaps with test box
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 15, y: 15, w: 30, h: 20, r: 0 } } // Node overlaps with test box
        ]
      });

      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 20, y: 20, w: 20, h: 10, r: 0 }; // Overlaps with node

      const result = provider.testGetViableNodes(testBox);

      // No nodes should be returned because the node intersects with test box
      expect(result.n).toHaveLength(0);
      expect(result.s).toHaveLength(0);
      expect(result.e).toHaveLength(0);
      expect(result.w).toHaveLength(0);
    });

    test('should filter out nodes without range overlap', () => {
      // Node that doesn't have overlapping ranges with test box
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 10, y: 100, w: 20, h: 15, r: 0 } } // Node far from test box with no range overlap
        ]
      });

      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 50, y: 50, w: 20, h: 15, r: 0 }; // No overlap on either axis

      const result = provider.testGetViableNodes(testBox);

      // No nodes should be returned because there's no alignment potential
      expect(result.n).toHaveLength(0);
      expect(result.s).toHaveLength(0);
      expect(result.e).toHaveLength(0);
      expect(result.w).toHaveLength(0);
    });

    test('should filter out rotated nodes', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 20, y: 10, w: 30, h: 20, r: 45 } } // Create node with rotation
        ]
      });

      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 25, y: 50, w: 20, h: 15, r: 0 };

      const result = provider.testGetViableNodes(testBox);

      // Rotated node should be filtered out
      expect(result.n).toHaveLength(0);
      expect(result.s).toHaveLength(0);
      expect(result.e).toHaveLength(0);
      expect(result.w).toHaveLength(0);
    });

    test('should respect eligibleNodePredicate', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 20, y: 10, w: 30, h: 20, r: 0 }, id: 'excluded-node' },
          { bounds: { x: 60, y: 10, w: 30, h: 20, r: 0 }, id: 'included-node' }
        ]
      });

      // Predicate that excludes the first node
      const provider = new TestNodeSnapProvider(diagram, id => id !== 'excluded-node');
      const testBox: Box = { x: 35, y: 50, w: 40, h: 15, r: 0 }; // Overlaps both horizontally

      const result = provider.testGetViableNodes(testBox);

      // Only one node should pass the predicate
      expect(result.n).toHaveLength(1);
      expect(result.n[0]!.id).toBe('included-node');
    });

    test('should handle multiple nodes in different directions', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { bounds: { x: 25, y: 10, w: 20, h: 15, r: 0 } }, // North
          { bounds: { x: 25, y: 80, w: 20, h: 15, r: 0 } }, // South
          { bounds: { x: 10, y: 35, w: 20, h: 15, r: 0 } }, // West
          { bounds: { x: 60, y: 35, w: 20, h: 15, r: 0 } } // East
        ]
      });

      const provider = new TestNodeSnapProvider(diagram, () => true);
      const testBox: Box = { x: 35, y: 40, w: 20, h: 10, r: 0 }; // Center box

      const result = provider.testGetViableNodes(testBox);

      expect(result.n).toHaveLength(1);
      expect(result.s).toHaveLength(1);
      expect(result.w).toHaveLength(1);
      expect(result.e).toHaveLength(1);
    });
  });
});
