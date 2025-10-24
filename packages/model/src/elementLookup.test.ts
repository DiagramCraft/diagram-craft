import { beforeEach, describe, expect, it } from 'vitest';
import { ElementLookup } from './elementLookup';
import { TestModel } from './test-support/testModel';
import type { DiagramNode } from './diagramNode';
import type { DiagramEdge } from './diagramEdge';

describe('ElementLookup', () => {
  let lookup: ElementLookup<DiagramNode>;
  let node1: DiagramNode;
  let node2: DiagramNode;
  let node3: DiagramNode;

  beforeEach(() => {
    const { layer } = TestModel.newDiagramWithLayer();
    lookup = new ElementLookup<DiagramNode>();

    // Create test nodes
    node1 = layer.addNode({ id: 'node-1' });
    node2 = layer.addNode({ id: 'node-2' });
    node3 = layer.addNode({ id: 'node-3' });
  });

  describe('set() and get()', () => {
    it('should add and retrieve elements', () => {
      lookup.set('node-1', node1);
      expect(lookup.get('node-1')).toBe(node1);
    });

    it('should replace existing element with same ID', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const replacementNode = layer.addNode({ id: 'node-1' });

      lookup.set('node-1', node1);
      lookup.set('node-1', replacementNode);

      expect(lookup.get('node-1')).toBe(replacementNode);
    });

    it('should return undefined for non-existent ID', () => {
      expect(lookup.get('non-existent')).toBeUndefined();
    });
  });

  describe('delete()', () => {
    it('should remove an element from the lookup', () => {
      lookup.set('node-1', node1);
      lookup.delete('node-1');
      expect(lookup.has('node-1')).toBe(false);
    });

    it('should not affect other elements', () => {
      lookup.set('node-1', node1);
      lookup.set('node-2', node2);
      lookup.delete('node-1');

      expect(lookup.has('node-2')).toBe(true);
    });

    it('should be idempotent', () => {
      lookup.delete('non-existent');
      expect(lookup.has('non-existent')).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return true for existing elements', () => {
      lookup.set('node-1', node1);
      expect(lookup.has('node-1')).toBe(true);
    });

    it('should return false for non-existent elements', () => {
      expect(lookup.has('non-existent')).toBe(false);
    });
  });

  describe('values() and keys()', () => {
    it('should return all elements and IDs in insertion order', () => {
      lookup.set('node-1', node1);
      lookup.set('node-2', node2);
      lookup.set('node-3', node3);

      expect(Array.from(lookup.values())).toEqual([node1, node2, node3]);
      expect(Array.from(lookup.keys())).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('should exclude deleted elements', () => {
      lookup.set('node-1', node1);
      lookup.set('node-2', node2);
      lookup.delete('node-1');

      expect(Array.from(lookup.values())).toEqual([node2]);
      expect(Array.from(lookup.keys())).toEqual(['node-2']);
    });
  });

  describe('type safety', () => {
    it('should work with DiagramNode type', () => {
      const nodeLookup = new ElementLookup<DiagramNode>();
      nodeLookup.set('node-1', node1);
      expect(nodeLookup.get('node-1')).toBe(node1);
    });

    it('should work with DiagramEdge type', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edgeLookup = new ElementLookup<DiagramEdge>();
      const edge1 = layer.addEdge({ id: 'edge-1' });

      edgeLookup.set('edge-1', edge1);
      expect(edgeLookup.get('edge-1')).toBe(edge1);
    });
  });
});
