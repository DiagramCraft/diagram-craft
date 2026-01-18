import { describe, expect, it } from 'vitest';
import { _test, cloneElements } from './diagramElementUtils';
import type { SerializedEdge, SerializedNode } from './serialization/serializedTypes';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';
import { isEdge, isNode } from './diagramElement';

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
      _test.assignNewIdsToSerializedElements([node]);

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
      _test.assignNewIdsToSerializedElements([parentNode]);

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
      _test.assignNewIdsToSerializedElements([edge]);

      // Verify
      expect(edge.id).not.toBe('old-id');
    });

    it('should update edge endpoints to reference new node IDs', () => {
      // Setup
      const node1: SerializedNode = {
        id: 'node-1',
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

      const node2: SerializedNode = {
        id: 'node-2',
        type: 'node',
        nodeType: 'basic',
        bounds: { x: 200, y: 0, w: 100, h: 100, r: 0 },
        anchors: [],
        props: {},
        metadata: {},
        texts: {
          text: ''
        }
      };

      const edge: SerializedEdge = {
        id: 'edge-1',
        type: 'edge',
        start: { node: { id: 'node-1' }, position: { x: 100, y: 50 }, offset: { x: 0, y: 0 } },
        end: { node: { id: 'node-2' }, position: { x: 200, y: 50 }, offset: { x: 0, y: 0 } },
        props: {},
        metadata: {}
      };

      // Act
      const mapping = _test.assignNewIdsToSerializedElements([node1, node2, edge]);

      // Verify
      expect(node1.id).not.toBe('node-1');
      expect(node2.id).not.toBe('node-2');
      expect(edge.id).not.toBe('edge-1');

      // Check that edge endpoints now reference the new node IDs
      expect('node' in edge.start).toBe(true);
      expect('node' in edge.end).toBe(true);
      if ('node' in edge.start) {
        expect(edge.start.node.id).toBe(node1.id);
        expect(mapping.get('node-1')).toBe(node1.id);
      }
      if ('node' in edge.end) {
        expect(edge.end.node.id).toBe(node2.id);
        expect(mapping.get('node-2')).toBe(node2.id);
      }
    });

    it('should convert edge endpoints to free endpoints when referenced node is not cloned', () => {
      // Setup
      const node1: SerializedNode = {
        id: 'node-1',
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

      // Edge references node-1 (which is cloned) and node-999 (which is not cloned)
      const edge: SerializedEdge = {
        id: 'edge-1',
        type: 'edge',
        start: { node: { id: 'node-1' }, position: { x: 100, y: 50 }, offset: { x: 0, y: 0 } },
        end: { node: { id: 'node-999' }, position: { x: 200, y: 50 }, offset: { x: 0, y: 0 } },
        props: {},
        metadata: {}
      };

      // Act
      _test.assignNewIdsToSerializedElements([node1, edge]);

      // Verify
      // Start endpoint should still reference the cloned node
      expect('node' in edge.start).toBe(true);
      if ('node' in edge.start) {
        expect(edge.start.node.id).toBe(node1.id);
      }

      // End endpoint should be converted to a free endpoint since node-999 wasn't cloned
      expect('position' in edge.end).toBe(true);
      expect('node' in edge.end).toBe(false);
      if ('position' in edge.end) {
        expect(edge.end.position).toEqual({ x: 200, y: 50 });
      }
    });
  });

  describe('cloneElements', () => {
    it('should clone a single node with new ID', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({ id: 'node-1', bounds: { x: 10, y: 20, w: 100, h: 50, r: 0 } });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([node], layer, uow));

      // Verify
      expect(cloned).toHaveLength(1);
      expect(cloned[0]!.id).not.toBe('node-1');
      expect(isNode(cloned[0]!)).toBe(true);
      expect(cloned[0]!.bounds).toEqual({ x: 10, y: 20, w: 100, h: 50, r: 0 });
    });

    it('should clone multiple nodes with new IDs', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode({ id: 'node-1' });
      const node2 = layer.addNode({ id: 'node-2' });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([node1, node2], layer, uow));

      // Verify
      expect(cloned).toHaveLength(2);
      expect(cloned[0]!.id).not.toBe('node-1');
      expect(cloned[1]!.id).not.toBe('node-2');
      expect(cloned[0]!.id).not.toBe(cloned[1]!.id);
    });

    it('should clone an edge with free endpoints', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge({ id: 'edge-1' });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([edge], layer, uow));

      // Verify
      expect(cloned).toHaveLength(1);
      expect(cloned[0]!.id).not.toBe('edge-1');
      expect(isEdge(cloned[0]!)).toBe(true);
    });

    it('should clone nodes and edges with connections preserved', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode({ id: 'node-1', bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({
        id: 'node-2',
        bounds: { x: 200, y: 0, w: 100, h: 100, r: 0 }
      });
      const edge = layer.addEdge({
        id: 'edge-1',
        startNodeId: 'node-1',
        endNodeId: 'node-2',
        startAnchor: 'e',
        endAnchor: 'w'
      });

      const originalNode1Id = node1.id;
      const originalNode2Id = node2.id;
      const originalEdgeId = edge.id;

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => {
        const result = cloneElements([node1, node2, edge], layer, uow);
        // Add cloned elements to layer to properly initialize them
        result.forEach(e => layer.addElement(e, uow));
        return result;
      });

      // Verify
      expect(cloned).toHaveLength(3);

      const clonedNodes = cloned.filter(isNode);
      const clonedEdges = cloned.filter(isEdge);

      expect(clonedNodes).toHaveLength(2);
      expect(clonedEdges).toHaveLength(1);

      const clonedNode1 = clonedNodes.find(n => n.bounds.x === 0);
      const clonedNode2 = clonedNodes.find(n => n.bounds.x === 200);
      const clonedEdge = clonedEdges[0]!;

      expect(clonedNode1).toBeDefined();
      expect(clonedNode2).toBeDefined();

      // Verify new IDs were assigned
      expect(clonedNode1!.id).not.toBe(originalNode1Id);
      expect(clonedNode2!.id).not.toBe(originalNode2Id);
      expect(clonedEdge.id).not.toBe(originalEdgeId);

      // Verify edge is connected to the cloned nodes
      expect(clonedEdge.start.isConnected).toBe(true);
      expect(clonedEdge.end.isConnected).toBe(true);
      if ('node' in clonedEdge.start) {
        expect(clonedEdge.start.node).toBe(clonedNode1);
      }
      if ('node' in clonedEdge.end) {
        expect(clonedEdge.end.node).toBe(clonedNode2);
      }

      // Verify the original edge still points to original nodes
      if ('node' in edge.start) {
        expect(edge.start.node).toBe(node1);
      }
      if ('node' in edge.end) {
        expect(edge.end.node).toBe(node2);
      }
    });

    it('should convert edge endpoints to free when connected node is not cloned', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode({ id: 'node-1' });
      layer.addNode({ id: 'node-2' }); // node2 - will not be cloned
      const edge = layer.addEdge({
        id: 'edge-1',
        startNodeId: 'node-1',
        endNodeId: 'node-2'
      });

      // Act - clone only node1 and edge, but not node2
      const cloned = UnitOfWork.execute(diagram, uow => {
        const result = cloneElements([node1, edge], layer, uow);
        // Add cloned elements to layer to properly initialize them
        result.forEach(e => layer.addElement(e, uow));
        return result;
      });

      // Verify
      expect(cloned).toHaveLength(2);

      const clonedNode = cloned.find(isNode)!;
      const clonedEdge = cloned.find(isEdge)!;

      expect(clonedNode).toBeDefined();
      expect(clonedEdge).toBeDefined();

      // Start should be connected to cloned node
      expect(clonedEdge.start.isConnected).toBe(true);
      if ('node' in clonedEdge.start) {
        expect(clonedEdge.start.node).toBe(clonedNode);
      }

      // End should be a free endpoint since node2 was not cloned
      expect(clonedEdge.end.isConnected).toBe(false);
      expect(clonedEdge.end.position).toBeDefined();
    });

    it('should clone node with children', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const parentNode = layer.addNode({ id: 'parent-node' });
      const childNode = layer.createNode({ id: 'child-node' });

      UnitOfWork.execute(diagram, uow => {
        parentNode.addChild(childNode, uow);
      });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([parentNode], layer, uow));

      // Verify
      expect(cloned).toHaveLength(1);
      const clonedParent = cloned[0]!;

      expect(clonedParent.id).not.toBe('parent-node');
      expect(isNode(clonedParent)).toBe(true);

      if (isNode(clonedParent)) {
        expect(clonedParent.children).toHaveLength(1);
        expect(clonedParent.children[0]!.id).not.toBe('child-node');
        expect(clonedParent.children[0]!.id).not.toBe(clonedParent.id);
      }
    });

    it('should preserve node properties when cloning', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({
        id: 'node-1',
        bounds: { x: 10, y: 20, w: 100, h: 50, r: 15 },
        props: {
          fill: { color: 'red' },
          stroke: { color: 'blue', width: 2 }
        }
      });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([node], layer, uow));

      // Verify
      expect(cloned).toHaveLength(1);
      const clonedNode = cloned[0]!;

      // Check specific properties instead of deep equality (renderProps include merged defaults)
      expect(clonedNode.renderProps.fill.color).toBe('red');
      expect(clonedNode.renderProps.stroke.color).toBe('blue');
      expect(clonedNode.renderProps.stroke.width).toBe(2);
      expect(clonedNode.bounds.r).toBe(15);
    });

    it('should clone to different layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const sourceLayer = layer;
      const targetLayer = (diagram as any).newLayer();

      const node = sourceLayer.addNode({ id: 'node-1' });

      // Act
      const cloned = UnitOfWork.execute(diagram, uow => cloneElements([node], targetLayer, uow));

      // Verify
      expect(cloned).toHaveLength(1);
      expect(cloned[0]!.layer).toBe(targetLayer);
      expect(node.layer).toBe(sourceLayer);
    });
  });
});
