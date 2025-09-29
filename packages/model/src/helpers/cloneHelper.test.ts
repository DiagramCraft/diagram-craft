import { describe, expect, it } from 'vitest';
import { assignNewIdsToSerializedElements } from './cloneHelper';
import type { SerializedEdge, SerializedNode } from '../serialization/types';

describe('cloneHelper', () => {
  describe('assignNewIdsToSerializedElements', () => {
    it('should assign a new ID to a serialized node', () => {
      // Setup
      const node: SerializedNode = {
        id: 'old-id',
        type: 'node',
        nodeType: 'basic',
        bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
        anchors: [],
        props: {},
        metadata: {},
        texts: {
          text: ''
        }
      };

      // Act
      assignNewIdsToSerializedElements(node);

      // Verify
      expect(node.id).not.toBe('old-id');
    });

    it('should assign new IDs to a serialized node and its children', () => {
      // Setup
      const childNode: SerializedNode = {
        id: 'child-id',
        type: 'node',
        nodeType: 'basic',
        bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 },
        anchors: [],
        props: {},
        metadata: {},
        texts: {
          text: ''
        }
      };

      const parentNode: SerializedNode = {
        id: 'parent-id',
        type: 'node',
        nodeType: 'basic',
        bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
        anchors: [],
        props: {},
        metadata: {},
        texts: {
          text: ''
        },
        children: [childNode]
      };

      // Act
      assignNewIdsToSerializedElements(parentNode);

      // Verify
      expect(parentNode.id).not.toBe('parent-id');
      expect(parentNode.children![0]!.id).not.toBe('child-id');
    });

    it('should assign a new ID to a serialized edge', () => {
      // Setup
      const edge: SerializedEdge = {
        id: 'old-id',
        type: 'edge',
        start: { position: { x: 0, y: 0 } },
        end: { position: { x: 100, y: 100 } },
        props: {},
        metadata: {}
      };

      // Act
      assignNewIdsToSerializedElements(edge);

      // Verify
      expect(edge.id).not.toBe('old-id');
    });
  });
});
