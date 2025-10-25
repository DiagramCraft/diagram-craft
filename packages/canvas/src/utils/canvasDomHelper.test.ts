import { describe, expect, test } from 'vitest';
import { CanvasDomHelper } from './canvasDomHelper';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('CanvasDomHelper', () => {
  describe('diagramId', () => {
    test('returns diagram ID prefixed with "diagram-"', () => {
      const { diagram } = TestModel.newDiagramWithLayer();

      const result = CanvasDomHelper.diagramId(diagram);

      expect(result).toBe(`diagram-${diagram.id}`);
    });

    test('returns consistent ID for same diagram', () => {
      const { diagram } = TestModel.newDiagramWithLayer();

      const id1 = CanvasDomHelper.diagramId(diagram);
      const id2 = CanvasDomHelper.diagramId(diagram);

      expect(id1).toBe(id2);
    });
  });

  describe('nodeId', () => {
    test('returns node ID prefixed with "node-"', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const result = CanvasDomHelper.nodeId(node);

      expect(result).toBe(`node-${node.id}`);
    });

    test('generates unique IDs for different nodes', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();

      const id1 = CanvasDomHelper.nodeId(node1);
      const id2 = CanvasDomHelper.nodeId(node2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('edgeId', () => {
    test('returns edge ID prefixed with "edge-"', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const result = CanvasDomHelper.edgeId(edge);

      expect(result).toBe(`edge-${edge.id}`);
    });

    test('generates unique IDs for different edges', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge1 = layer.addEdge();
      const edge2 = layer.addEdge();

      const id1 = CanvasDomHelper.edgeId(edge1);
      const id2 = CanvasDomHelper.edgeId(edge2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('elementId', () => {
    test('returns node ID for node element', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      const result = CanvasDomHelper.elementId(node);

      expect(result).toBe(`node-${node.id}`);
    });

    test('returns edge ID for edge element', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const result = CanvasDomHelper.elementId(edge);

      expect(result).toBe(`edge-${edge.id}`);
    });

    test('handles different element types correctly', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      const edge = layer.addEdge();

      const nodeId = CanvasDomHelper.elementId(node);
      const edgeId = CanvasDomHelper.elementId(edge);

      expect(nodeId).toMatch(/^node-/);
      expect(edgeId).toMatch(/^edge-/);
      expect(nodeId).not.toBe(edgeId);
    });
  });
});
