import { beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import {
  TestDiagramBuilder,
  TestDiagramNodeBuilder,
  TestModel,
  TestLayerBuilder
} from './test-support/builder';

describe('DiagramNode', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;
  let uow: UnitOfWork;
  let node: TestDiagramNodeBuilder;

  const resetUow = () => (uow = UnitOfWork.immediate(diagram));

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();

    uow = UnitOfWork.immediate(diagram);
    node = layer.createNode();
  });

  describe('isLabelNode', () => {
    it('should return true when the parent is an edge', () => {
      const edge = layer.createEdge();
      node._setParent(edge);

      expect(node.isLabelNode()).toBe(true);
    });

    it('should return false when the parent is not an edge', () => {
      const anotherNode = layer.createNode();
      node._setParent(anotherNode);

      expect(node.isLabelNode()).toBe(false);
    });

    it('should return false when there is no parent', () => {
      node._setParent(undefined);

      expect(node.isLabelNode()).toBe(false);
    });
  });

  describe('labelNode', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = layer.createNode();
      node._setParent(anotherNode);

      expect(node.labelNode()).toBeUndefined();
    });

    it('should return the corresponding label node when the node is a label node', () => {
      const edge = layer.createEdge();

      const labelNode = node.asLabelNode();
      edge.setLabelNodes([labelNode], uow);

      expect(node.labelNode()!.node).toEqual(node);
    });
  });

  describe('labelEdge', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = layer.createNode();
      node._setParent(anotherNode);

      expect(node.labelEdge()).toBeUndefined();
    });

    it('should return the associated edge when the node is a label node', () => {
      const edge = layer.createEdge();
      node._setParent(edge);

      expect(node.labelEdge()).toBe(edge);
    });
  });

  describe('name', () => {
    it('should return "nodeType / id" when no metadata name or text is available', () => {
      node.updateMetadata(metadata => (metadata.name = ''), uow);
      node.setText('', uow);

      expect(node.name).toBe(`${node.nodeType} / ${node.id}`);
    });

    it('should return metadata name if set', () => {
      const customName = 'Custom Node Name';
      node.updateMetadata(metadata => (metadata.name = customName), uow);

      expect(node.name).toBe(customName);
    });

    it('should format name based on text template if text is available', () => {
      node.setText('Hello, %value%!', uow);
      node.updateMetadata(metadata => (metadata.data = { customData: { value: 'Node1' } }), uow);

      expect(node.name).toBe('Hello, Node1!');
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      const child = layer.createNode();
      node.addChild(child, uow);

      expect(child.parent).toBe(node);
    });

    it('should append the child to the children array if no relation is provided', () => {
      const child = layer.createNode();
      node.addChild(child, uow);

      expect(node.children[node.children.length - 1]).toBe(child);
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer.createNode();
      node.addChild(child, uow);

      expect(uow.contains(node, 'update')).toBe(true);
      expect(uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      const child = layer.createNode();
      node.addChild(child, uow);
      expect(diagram.lookup(child.id)).toBe(child);
    });

    it('should not add the child if it is already present', () => {
      const child = layer.createNode();
      node.addChild(child, uow);
      expect(() => node.addChild(child, uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      const child = layer.createNode();
      const otherDiagram = TestModel.newDiagram();
      const other = otherDiagram.newLayer().createNode();
      expect(() => other.addChild(child, uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      const child = layer.createNode();
      node.addChild(child, uow);
      node.removeChild(child, uow);
      expect(node.children.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      const child = layer.createNode();
      expect(() => node.removeChild(child, uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer.createNode();
      node.addChild(child, uow);

      resetUow();
      node.removeChild(child, uow);
      expect(uow.contains(node, 'update')).toBe(true);
      expect(uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      const child1 = layer.createNode();
      const child2 = layer.createNode();
      node.setChildren([child1, child2], uow);
      expect(node.children).toEqual([child1, child2]);
    });

    it('should remove all children from the previous set', () => {
      const child1 = layer.createNode();
      const child2 = layer.createNode();
      node.addChild(child1, uow);
      node.addChild(child2, uow);

      resetUow();
      node.setChildren([child1], uow);
      expect(node.children).toEqual([child1]);

      expect(uow.contains(node, 'update')).toBe(true);
      expect(uow.contains(child1, 'update')).toBe(true);
      expect(uow.contains(child2, 'remove')).toBe(true);
    });
  });
});
