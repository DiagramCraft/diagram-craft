import { describe, expect, test } from 'vitest';
import { NodeSnapProvider } from './nodeSnapProvider';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import type { MatchingMagnetPair } from './snapManager';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('NodeSnapProvider', () => {
  describe('getMagnets', () => {
    describe('getMagnets - basic functionality', () => {
      test('should create magnets for eligible nodes', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 50, y: 50, w: 100, h: 80, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 0, y: 60, w: 30, h: 40, r: 0 }; // Overlaps vertically

        const magnets = provider.getMagnets(testBox);

        // Should create magnets for the node (center lines + edges)
        expect(magnets.length).toBeGreaterThan(0);

        // All magnets should be of type 'node'
        magnets.forEach(magnet => {
          expect(magnet.type).toBe('node');
          expect(magnet.node).toBeDefined();
        });
      });

      test('should extend horizontal magnet lines to full diagram width', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 200, w: 50, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 50, y: 210, w: 30, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const horizontalMagnets = magnets.filter(m => Line.isHorizontal(m.line));

        // Horizontal magnets should span full diagram width
        horizontalMagnets.forEach(magnet => {
          expect(magnet.line.from.x).toBe(0);
          expect(magnet.line.to.x).toBe(diagram.viewBox.dimensions.w);
        });
      });

      test('should extend vertical magnet lines to full diagram height', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 200, w: 50, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 50, w: 30, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);
        const verticalMagnets = magnets.filter(m => !Line.isHorizontal(m.line));

        // Vertical magnets should span full diagram height
        verticalMagnets.forEach(magnet => {
          expect(magnet.line.from.y).toBe(0);
          expect(magnet.line.to.y).toBe(diagram.viewBox.dimensions.h);
        });
      });

      test('should create both horizontal and vertical magnets', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 100, w: 60, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 }; // Overlaps both axes

        const magnets = provider.getMagnets(testBox);

        const horizontalMagnets = magnets.filter(m => Line.isHorizontal(m.line));
        const verticalMagnets = magnets.filter(m => !Line.isHorizontal(m.line));

        expect(horizontalMagnets.length).toBeGreaterThan(0);
        expect(verticalMagnets.length).toBeGreaterThan(0);
      });

      test('magnet axis', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 100, w: 60, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 }; // Overlaps both axes

        const magnets = provider.getMagnets(testBox);

        for (const m of magnets) {
          if (Line.isHorizontal(m.line)) {
            expect(m.axis).toBe('h');
          } else {
            expect(m.axis).toBe('v');
          }
        }
      });
    });

    describe('getMagnets - filtering behavior', () => {
      test('should filter out non-node elements', () => {
        const { diagram, layer } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 50, y: 50, w: 40, h: 30, r: 0 } }]
        });

        // Add another node and an edge
        layer.addNode({ bounds: { x: 200, y: 50, w: 40, h: 30, r: 0 } });

        // Add an edge (non-node element)
        layer.addEdge();

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 0, y: 50, w: 30, h: 30, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Should only create magnets from nodes, not edges
        magnets.forEach(magnet => {
          expect(magnet.node).toBeDefined();
          expect(magnet.node.nodeType).toBeDefined(); // Nodes have nodeType, edges don't
        });

        // Should create magnets from the nodes
        expect(magnets.length).toBeGreaterThan(0);
      });

      test('should filter out label nodes', () => {
        const { diagram, layer } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 50, y: 50, w: 40, h: 30, r: 0 } }]
        });

        // Add a label node
        const labelNode = layer.addNode({
          id: 'label',
          bounds: { x: 150, y: 50, w: 40, h: 30, r: 0 }
        });
        // Mock isLabelNode to return true
        labelNode.isLabelNode = () => true;

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 0, y: 50, w: 30, h: 30, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Should not create magnets from label nodes
        const labelMagnets = magnets.filter(m => m.node.id === 'label');
        expect(labelMagnets).toHaveLength(0);
      });

      test('should respect eligibleNodePredicate', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 50, w: 40, h: 30, r: 0 }, id: 'node1' },
            { bounds: { x: 150, y: 50, w: 40, h: 30, r: 0 }, id: 'node2' }
          ]
        });

        // Predicate that excludes node2
        const provider = new NodeSnapProvider(diagram, id => id !== 'node2');
        const testBox = { x: 0, y: 50, w: 30, h: 30, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Should not create magnets from excluded nodes
        const node2Magnets = magnets.filter(m => m.node.id === 'node2');
        expect(node2Magnets).toHaveLength(0);

        // Should still create magnets from eligible nodes
        const node1Magnets = magnets.filter(m => m.node.id === 'node1');
        expect(node1Magnets.length).toBeGreaterThan(0);
      });

      test('should filter out nodes without range overlap', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 50, w: 40, h: 30, r: 0 } }, // No overlap
            { bounds: { x: 150, y: 200, w: 40, h: 30, r: 0 } } // No overlap
          ]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 0, y: 100, w: 20, h: 20, r: 0 }; // No overlap with either node

        const magnets = provider.getMagnets(testBox);

        // Should not create magnets when there's no range overlap
        expect(magnets).toHaveLength(0);
      });

      test('should include nodes with horizontal range overlap only', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 200, w: 40, h: 30, r: 0 } } // Horizontal overlap but not vertical
          ]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 60, y: 50, w: 20, h: 20, r: 0 }; // Overlaps horizontally

        const magnets = provider.getMagnets(testBox);

        // Should create magnets based on horizontal overlap
        expect(magnets.length).toBeGreaterThan(0);
      });

      test('should include nodes with vertical range overlap only', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 200, y: 50, w: 40, h: 30, r: 0 } } // Vertical overlap but not horizontal
          ]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 50, y: 60, w: 20, h: 20, r: 0 }; // Overlaps vertically

        const magnets = provider.getMagnets(testBox);

        // Should create magnets based on vertical overlap
        expect(magnets.length).toBeGreaterThan(0);
      });
    });

    describe('getMagnets - magnet properties', () => {
      test('should set correct axis for magnets', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 100, w: 60, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);

        magnets.forEach(magnet => {
          if (Line.isHorizontal(magnet.line)) {
            expect(magnet.axis).toBe(Axis.h);
          } else {
            expect(magnet.axis).toBe(Axis.v);
          }
        });
      });

      test('should attach node reference to magnets', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 100, w: 60, h: 40, r: 0 }, id: 'test-node' }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);

        magnets.forEach(magnet => {
          expect(magnet.node).toBeDefined();
          expect(magnet.node.id).toBe('test-node');
        });
      });

      test('should sort magnets by distance and remove duplicates', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [
            { bounds: { x: 50, y: 100, w: 40, h: 30, r: 0 } }, // Closer to test box
            { bounds: { x: 200, y: 100, w: 40, h: 30, r: 0 } } // Further from test box
          ]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 0, y: 110, w: 30, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Check that we don't have duplicate horizontal lines at same Y position
        const horizontalMagnets = magnets.filter(m => Line.isHorizontal(m.line));
        const yPositions = horizontalMagnets.map(m => m.line.from.y);
        const uniqueYPositions = [...new Set(yPositions)];

        expect(uniqueYPositions.length).toBe(yPositions.length);
      });
    });

    describe('getMagnets - magnet types', () => {
      test('should create magnets for node centers and edges', () => {
        const { diagram } = TestModel.newDiagramWithLayer({
          nodes: [{ bounds: { x: 100, y: 100, w: 60, h: 40, r: 0 } }]
        });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Should have magnets for various positions (center + edges)
        // Exact count depends on which magnets pass the range overlap filter
        expect(magnets.length).toBeGreaterThan(2);

        // Check that we have both center and edge magnets by looking at subtypes
        const centerMagnets = magnets.filter(m => (m as any).subtype === 'center');
        const edgeMagnets = magnets.filter(m => (m as any).matchDirection);

        expect(centerMagnets.length).toBeGreaterThan(0);
        expect(edgeMagnets.length).toBeGreaterThan(0);
      });

      test('should handle rotated nodes by only creating center magnets', () => {
        const { diagram, layer } = TestModel.newDiagramWithLayer();

        // Add a rotated node
        layer.addNode({ bounds: { x: 100, y: 100, w: 60, h: 40, r: Math.PI / 4 } });

        const provider = new NodeSnapProvider(diagram, () => true);
        const testBox = { x: 110, y: 110, w: 40, h: 20, r: 0 };

        const magnets = provider.getMagnets(testBox);

        // Should only have center magnets for rotated nodes
        magnets.forEach(magnet => {
          const subtype = (magnet as any).subtype;
          const matchDirection = (magnet as any).matchDirection;

          // For rotated nodes, should only have center magnets, not edge magnets
          if (subtype !== 'center') {
            expect(matchDirection).toBeUndefined();
          }
        });
      });
    });
  });

  describe('highlight', () => {
    test('should create highlight for horizontal alignment', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 100, y: 200, w: 50, h: 40, r: 0 } }]
      });

      const provider = new NodeSnapProvider(diagram, () => true);
      const testBox = { x: 50, y: 210, w: 30, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const horizontalMagnet = magnets.find(m => Line.isHorizontal(m.line))!;

      const sourceMagnet = {
        line: Line.horizontal(215, Range.of(50, 80)), // Test box center horizontal line
        axis: Axis.h,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'node'> = {
        self: sourceMagnet,
        matching: horizontalMagnet,
        distance: 0
      };

      const highlight = provider.highlight(testBox, matchingPair, Axis.h);

      expect(highlight).toBeDefined();
      expect(highlight.line).toBeDefined();
      expect(Line.isHorizontal(highlight.line)).toBe(true);
      expect(highlight.matchingMagnet).toBe(horizontalMagnet);
      expect(highlight.selfMagnet).toBe(sourceMagnet);

      // Highlight should span from leftmost to rightmost edge of both elements
      const expectedMinX = Math.min(testBox.x, horizontalMagnet.node.bounds.x);
      const expectedMaxX = Math.max(
        testBox.x + testBox.w,
        horizontalMagnet.node.bounds.x + horizontalMagnet.node.bounds.w
      );

      expect(highlight.line.from.x).toBe(expectedMinX);
      expect(highlight.line.to.x).toBe(expectedMaxX);
    });

    test('should create highlight for vertical alignment', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 100, y: 200, w: 50, h: 40, r: 0 } }]
      });

      const provider = new NodeSnapProvider(diagram, () => true);
      const testBox = { x: 110, y: 50, w: 30, h: 20, r: 0 };

      const magnets = provider.getMagnets(testBox);
      const verticalMagnet = magnets.find(m => !Line.isHorizontal(m.line))!;

      const sourceMagnet = {
        line: Line.vertical(125, Range.of(50, 70)), // Test box center vertical line
        axis: Axis.v,
        type: 'source' as const
      };

      const matchingPair: MatchingMagnetPair<'node'> = {
        self: sourceMagnet,
        matching: verticalMagnet,
        distance: 0
      };

      const highlight = provider.highlight(testBox, matchingPair, Axis.v);

      expect(highlight).toBeDefined();
      expect(highlight.line).toBeDefined();
      expect(Line.isHorizontal(highlight.line)).toBe(false);
      expect(highlight.matchingMagnet).toBe(verticalMagnet);
      expect(highlight.selfMagnet).toBe(sourceMagnet);

      // Highlight should span from topmost to bottommost edge of both elements
      const expectedMinY = Math.min(testBox.y, verticalMagnet.node.bounds.y);
      const expectedMaxY = Math.max(
        testBox.y + testBox.h,
        verticalMagnet.node.bounds.y + verticalMagnet.node.bounds.h
      );

      expect(highlight.line.from.y).toBe(expectedMinY);
      expect(highlight.line.to.y).toBe(expectedMaxY);
    });

    test('should position highlight at correct coordinate', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ bounds: { x: 100, y: 150, w: 50, h: 40, r: 0 } }]
      });

      const provider = new NodeSnapProvider(diagram, () => true);
      const testBox = { x: 50, y: 160, w: 30, h: 20, r: 0 }; // Horizontal center at y=170

      const magnets = provider.getMagnets(testBox);
      const centerMagnet = magnets.find(
        m => Line.isHorizontal(m.line) && (m as any).subtype === 'center'
      );

      if (centerMagnet) {
        const sourceMagnet = {
          line: Line.horizontal(170, Range.of(50, 80)),
          axis: Axis.h,
          type: 'source' as const
        };

        const matchingPair: MatchingMagnetPair<'node'> = {
          self: sourceMagnet,
          matching: centerMagnet,
          distance: 0
        };

        const highlight = provider.highlight(testBox, matchingPair, Axis.h);

        // Highlight should be positioned at the center line coordinate
        expect(highlight.line.from.y).toBe(170);
        expect(highlight.line.to.y).toBe(170);
      }
    });
  });
});
