import { describe, expect, test } from 'vitest';
import { placeNode } from './placeNode';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Box } from '@diagram-craft/geometry/box';

describe('placeNode', () => {
  describe('basic placement', () => {
    test('places node to the right of reference when space is available', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } }]
      });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const boundsToPlace = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const result = placeNode(boundsToPlace, referenceNode, diagram);

      // Should be placed to the right of reference with minDistance spacing
      expect(result.w).toBe(40);
      expect(result.h).toBe(40);
      expect(result.r).toBe(0);
      expect(result.x).toBeGreaterThan(150); // ref.x + ref.w + spacing
    });
  });

  describe('overlap avoidance', () => {
    test('avoids overlapping with existing nodes', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } },
          { id: 'blocker', bounds: { x: 160, y: 100, w: 50, h: 50, r: 0 } }
        ]
      });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const blockerNode = diagram.nodeLookup.get('blocker')!;
      const boundsToPlace = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      const result = placeNode(boundsToPlace, referenceNode, diagram);

      // Should not overlap with either node
      expect(Box.intersects(Box.grow(result, 10), referenceNode.bounds)).toBe(false);
      expect(Box.intersects(Box.grow(result, 10), blockerNode.bounds)).toBe(false);
    });

    test('maintains minimum distance from existing nodes', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } },
          { id: 'blocker', bounds: { x: 160, y: 100, w: 50, h: 50, r: 0 } }
        ]
      });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const blockerNode = diagram.nodeLookup.get('blocker')!;
      const boundsToPlace = { x: 0, y: 0, w: 40, h: 40, r: 0 };
      const minDistance = 15;

      const result = placeNode(boundsToPlace, referenceNode, diagram, { minDistance });

      // Check that grown bounds don't intersect
      expect(Box.intersects(Box.grow(result, minDistance), referenceNode.bounds)).toBe(false);
      expect(Box.intersects(Box.grow(result, minDistance), blockerNode.bounds)).toBe(false);
    });

    test('finds space in a crowded diagram', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } },
          { id: 'n1', bounds: { x: 160, y: 100, w: 40, h: 40, r: 0 } },
          { id: 'n2', bounds: { x: 100, y: 160, w: 40, h: 40, r: 0 } },
          { id: 'n3', bounds: { x: 40, y: 100, w: 40, h: 40, r: 0 } }
        ]
      });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const boundsToPlace = { x: 0, y: 0, w: 30, h: 30, r: 0 };

      const result = placeNode(boundsToPlace, referenceNode, diagram);

      // Should find some valid position
      const allNodes = [
        diagram.nodeLookup.get('ref')!,
        diagram.nodeLookup.get('n1')!,
        diagram.nodeLookup.get('n2')!,
        diagram.nodeLookup.get('n3')!
      ];

      for (const node of allNodes) {
        expect(Box.intersects(Box.grow(result, 10), node.bounds)).toBe(false);
      }
    });
  });

  describe('layer options', () => {
    test('considers only active layer by default', () => {
      const { diagram } = TestModel.newDiagramWithLayer();

      // Add another layer with a blocking node
      const layer2 = diagram.newLayer();
      layer2.addNode({ id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } });
      layer2.addNode({ id: 'blocker', bounds: { x: 160, y: 100, w: 50, h: 50, r: 0 } });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const boundsToPlace = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      // Place with default (active layer only)
      const result = placeNode(boundsToPlace, referenceNode, diagram);

      // Should be able to place in a position that would overlap with blocker
      // because blocker is on a different layer and is not considered
      // The algorithm should not avoid the blocker
      expect(Box.intersects(Box.grow(result, 10), referenceNode.bounds)).toBe(false);

      // The result might overlap with blocker since it's on a different layer
      // Just verify we got a reasonable position
      expect(result.x).toBeGreaterThan(referenceNode.bounds.x);
    });

    test('considers all layers when option is set', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [{ id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } }]
      });

      // Add another layer with a blocking node
      const layer2 = diagram.newLayer();
      layer2.addNode({ id: 'blocker', bounds: { x: 160, y: 100, w: 50, h: 50, r: 0 } });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const blockerNode = diagram.nodeLookup.get('blocker')!;
      const boundsToPlace = { x: 0, y: 0, w: 40, h: 40, r: 0 };

      // Place considering all layers
      const result = placeNode(boundsToPlace, referenceNode, diagram, {
        considerAllLayers: true
      });

      // Should avoid the blocker on the other layer
      expect(Box.intersects(Box.grow(result, 10), blockerNode.bounds)).toBe(false);
    });
  });

  describe('custom minDistance', () => {
    test('respects custom minimum distance', () => {
      const { diagram } = TestModel.newDiagramWithLayer({
        nodes: [
          { id: 'ref', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } },
          { id: 'nearby', bounds: { x: 170, y: 100, w: 40, h: 40, r: 0 } }
        ]
      });

      const referenceNode = diagram.nodeLookup.get('ref')!;
      const nearbyNode = diagram.nodeLookup.get('nearby')!;
      const boundsToPlace = { x: 0, y: 0, w: 30, h: 30, r: 0 };
      const customDistance = 25;

      const result = placeNode(boundsToPlace, referenceNode, diagram, {
        minDistance: customDistance
      });

      // Should maintain the custom distance
      expect(Box.intersects(Box.grow(result, customDistance), nearbyNode.bounds)).toBe(false);
    });
  });
});
