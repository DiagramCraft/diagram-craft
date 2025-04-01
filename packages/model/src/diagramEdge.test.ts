import { beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint } from './endpoint';
import { DiagramEdge } from './diagramEdge';
import { TestDiagramBuilder, TestModel, TestLayerBuilder } from './test-support/builder';

describe('DiagramEdge', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;
  let uow: UnitOfWork;
  let edge: DiagramEdge;

  const resetUow = () => (uow = UnitOfWork.immediate(diagram));

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();

    uow = UnitOfWork.immediate(diagram);
    edge = layer.createEdge();
  });

  describe('name', () => {
    it('should return the name from the first label node if label nodes exist', () => {
      const node = layer.createNode();
      node.setText('LabelNodeName', uow);

      edge.setLabelNodes([node.asLabelNode()], uow);

      expect(edge.name).toBe('LabelNodeName');
    });

    it('should return the metadata name if no label nodes and metadata name is set', () => {
      edge.updateMetadata(props => {
        props.name = 'MetadataName';
        return props;
      }, uow);

      expect(edge.name).toBe('MetadataName');
    });

    it('should return the concatenated names of connected nodes if no label nodes or metadata name', () => {
      const start = layer.createNode();
      start.setText('StartNode', uow);

      const end = layer.createNode();
      end.setText('EndNode', uow);

      edge.setStart(new AnchorEndpoint(start, 'c'), uow);
      edge.setEnd(new AnchorEndpoint(end, 'c'), uow);

      expect(edge.name).toBe('StartNode - EndNode');
    });

    it('should return the edge id if no label nodes, metadata name, or connected node names', () => {
      expect(edge.name).toBe(edge.id);
    });
  });

  describe('bounds', () => {
    it('should return a box defined by the start and end positions', () => {
      const startNode = layer.createNode();
      startNode.setBounds({ x: 10, y: 20, w: 10, h: 10, r: 0 }, uow);

      const endNode = layer.createNode();
      endNode.setBounds({ x: 100, y: 200, w: 10, h: 10, r: 0 }, uow);

      edge.setStart(new AnchorEndpoint(startNode, 'c'), uow);
      edge.setEnd(new AnchorEndpoint(endNode, 'c'), uow);

      const bounds = edge.bounds;
      expect(bounds.x).toEqual(15);
      expect(bounds.y).toEqual(25);
      expect(bounds.w).toEqual(90);
      expect(bounds.h).toEqual(180);
    });
  });

  describe('labelNodes', () => {
    it('should return undefined when no label nodes are set', () => {
      expect(edge.labelNodes).toBeUndefined();
    });

    it('should return correct label nodes after setting them', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.setLabelNodes([labelNode], uow);

      expect(edge.labelNodes).toEqual([labelNode]);
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);

      expect(child.parent).toBe(edge);
    });

    it('should append the child to the children array if no relation is provided', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);

      expect(edge.children[edge.children.length - 1]).toBe(child);
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);

      expect(uow.contains(edge, 'update')).toBe(true);
      expect(uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);
      expect(diagram.lookup(child.id)).toBe(child);
    });

    it('should be added to labelNodes if it is a label node', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);
      expect(edge.labelNodes?.length).toBe(1);
      expect(edge.labelNodes?.[0].node.id).toBe(child.id);
    });

    it('should not add the child if it is already present', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);
      expect(() => edge.addChild(child, uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      const child = layer.createNode();
      const otherDiagram = TestModel.newDiagram();
      const otherEdge = otherDiagram.newLayer().addEdge();
      expect(() => otherEdge.addChild(child, uow)).toThrow();
    });

    it('should fail is the child is an edge', () => {
      const child = layer.addEdge();
      expect(() => edge.addChild(child, uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);
      edge.removeChild(child, uow);
      expect(edge.children.length).toBe(0);
    });

    it('should remove the child from the labelNodes array if it is a label node', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);
      edge.removeChild(child, uow);
      expect(edge.labelNodes?.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      const child = layer.createNode();
      expect(() => edge.removeChild(child, uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer.createNode();
      edge.addChild(child, uow);

      resetUow();
      edge.removeChild(child, uow);
      expect(uow.contains(edge, 'update')).toBe(true);
      expect(uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      const child1 = layer.createNode();
      const child2 = layer.createNode();
      edge.setChildren([child1, child2], uow);
      expect(edge.children).toEqual([child1, child2]);
    });

    it('should remove all children from the previous set', () => {
      const child1 = layer.createNode();
      const child2 = layer.createNode();
      edge.addChild(child1, uow);
      edge.addChild(child2, uow);

      resetUow();
      edge.setChildren([child1], uow);
      expect(edge.children).toEqual([child1]);

      expect(uow.contains(edge, 'update')).toBe(true);
      expect(uow.contains(child1, 'update')).toBe(true);
      expect(uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setLabelNodes', () => {
    it('should set the label nodes correctly', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.setLabelNodes([labelNode], uow);
      expect(edge.labelNodes).toEqual([labelNode]);
    });

    it('should remove all label nodes from the previous set', () => {
      const labelNode1 = layer.createNode().asLabelNode();
      const labelNode2 = layer.createNode().asLabelNode();
      edge.setLabelNodes([labelNode1, labelNode2], uow);
      expect(edge.labelNodes).toEqual([labelNode1, labelNode2]);
      expect(edge.labelNodes?.length).toBe(2);

      edge.setLabelNodes([labelNode1], uow);
      expect(edge.labelNodes).toEqual([labelNode1]);
      expect(edge.labelNodes?.length).toBe(1);
    });

    it('should remove update children', () => {
      const labelNode1 = layer.createNode().asLabelNode();
      const labelNode2 = layer.createNode().asLabelNode();
      edge.setLabelNodes([labelNode1, labelNode2], uow);
      expect(edge.children).toEqual([labelNode1.node, labelNode2.node]);
      expect(edge.children?.length).toBe(2);

      edge.setLabelNodes([labelNode1], uow);
      expect(edge.children).toEqual([labelNode1.node]);
      expect(edge.children?.length).toBe(1);
    });
  });

  describe('addLabelNode', () => {
    it('should add the label node to the label nodes array', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.addLabelNode(labelNode, uow);
      expect(edge.labelNodes).toEqual([labelNode]);
    });

    it('should update the label node in the UnitOfWork', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.addLabelNode(labelNode, uow);
      expect(uow.contains(edge, 'update')).toBe(true);
      expect(uow.contains(labelNode.node, 'update')).toBe(true);
    });

    it('should fail if the label node is already present', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.addLabelNode(labelNode, uow);
      expect(() => edge.addLabelNode(labelNode, uow)).toThrow();
    });

    it('should update children', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.addChild(labelNode.node, uow);
      expect(edge.children).toEqual([labelNode.node]);
    });
  });

  describe('removeLabelNode', () => {
    it('should remove the label node from the label nodes array', () => {
      const labelNode = layer.createNode().asLabelNode();
      edge.addLabelNode(labelNode, uow);
      edge.removeLabelNode(labelNode, uow);
      expect(edge.labelNodes).toEqual([]);
      expect(edge.children).toEqual([]);
    });

    it('should fail if the label node is not present', () => {
      const labelNode = layer.createNode().asLabelNode();
      expect(() => edge.removeLabelNode(labelNode, uow)).toThrow();
    });
  });
});
