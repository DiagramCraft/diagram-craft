import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint } from './endpoint';
import { TestDiagramBuilder, TestLayerBuilder, TestModel } from './test-support/builder';
import { Backends } from './collaboration/yjs/collaborationTestUtils';
import type { DiagramDocument } from './diagramDocument';
import { RegularLayer } from './diagramLayerRegular';
import { DiagramNode } from './diagramNode';
import { DiagramEdge } from './diagramEdge';
import type { Diagram } from './diagram';

describe.for(Backends.all())('DiagramEdge [%s]', ([_name, backend]) => {
  let diagram1: TestDiagramBuilder;
  let layer1: TestLayerBuilder;
  let uow: UnitOfWork;
  let edge1: DiagramEdge;
  let edge1_2: DiagramEdge | undefined;

  let doc2: DiagramDocument | undefined;
  let diagram2: Diagram | undefined;

  beforeEach(() => {
    backend.beforeEach();

    const [root1, root2] = backend.syncedDocs();

    diagram1 = TestModel.newDiagram(root1);
    layer1 = diagram1.newLayer();

    doc2 = root2 ? TestModel.newDocument(root2) : undefined;

    uow = UnitOfWork.immediate(diagram1);
    edge1 = layer1.createEdge();
    layer1.addElement(edge1, uow);

    diagram2 = doc2?.topLevelDiagrams?.[0];
    edge1_2 = (diagram2?.layers?.all?.[0] as RegularLayer)?.elements[0] as DiagramEdge;
  });
  afterEach(backend.afterEach);

  const resetUow = () => (uow = UnitOfWork.immediate(diagram1));

  // TODO: Move to diagramNode.test.ts
  describe('DiagramNode.detachCRDT', () => {
    it('text is kept when detaching', () => {
      const node = layer1.addNode();
      node.setText('LabelNodeName', uow);

      expect(node.getText()).toBe('LabelNodeName');
      if (doc2) {
        const n = doc2.topLevelDiagrams[0].lookup(node.id) as DiagramNode;
        expect(n.getText()).toBe('LabelNodeName');
      }

      node.detachCRDT();

      expect(node.getText()).toBe('LabelNodeName');
      if (doc2) {
        const n = doc2.topLevelDiagrams[0].lookup(node.id) as DiagramNode;
        expect(n.getText()).toBe('LabelNodeName');
      }
    });
  });

  describe('name', () => {
    it('should return the name from the first label node if label nodes exist', () => {
      const node = layer1.addNode();
      node.setText('LabelNodeName', uow);

      expect(node.getText()).toBe('LabelNodeName');
      if (doc2) expect(diagram2!.nodeLookup.get(node.id)?.getText()).toBe('LabelNodeName');

      const labelNode = node.asLabelNode();
      edge1.setLabelNodes([labelNode], uow);

      expect(edge1.name).toBe('LabelNodeName');
      if (doc2) expect(edge1_2?.name).toBe('LabelNodeName');
    });

    it('should return the metadata name if no label nodes and metadata name is set', () => {
      edge1.updateMetadata(props => {
        props.name = 'MetadataName';
        return props;
      }, uow);

      expect(edge1.name).toBe('MetadataName');
      if (doc2) expect(edge1_2?.name).toBe('MetadataName');
    });

    it('should return the concatenated names of connected nodes if no label nodes or metadata name', () => {
      const start = layer1.addNode();
      start.setText('StartNode', uow);

      const end = layer1.addNode();
      end.setText('EndNode', uow);

      edge1.setStart(new AnchorEndpoint(start, 'c'), uow);
      edge1.setEnd(new AnchorEndpoint(end, 'c'), uow);

      expect(edge1.name).toBe('StartNode - EndNode');
      if (doc2) expect(edge1_2?.name).toBe('StartNode - EndNode');
    });

    it('should return the edge id if no label nodes, metadata name, or connected node names', () => {
      expect(edge1.name).toBe(edge1.id);
      if (doc2) expect(edge1_2?.name).toBe(edge1.id);
    });
  });

  describe('bounds', () => {
    it('should return a box defined by the start and end positions', () => {
      // Setup
      const startNode = layer1.addNode();
      startNode.setBounds({ x: 10, y: 20, w: 10, h: 10, r: 0 }, uow);

      const endNode = layer1.addNode();
      endNode.setBounds({ x: 100, y: 200, w: 10, h: 10, r: 0 }, uow);

      // Act
      edge1.setStart(new AnchorEndpoint(startNode, 'c'), uow);
      edge1.setEnd(new AnchorEndpoint(endNode, 'c'), uow);

      // Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
      if (doc2) expect(edge1_2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
    });
  });

  describe('labelNodes', () => {
    it('should return empty array when no label nodes are set', () => {
      expect(edge1.labelNodes).toEqual([]);
      if (doc2) expect(edge1_2!.labelNodes).toEqual([]);
    });

    it('should return correct label nodes after setting them', () => {
      const labelNode = layer1.addNode().asLabelNode();
      edge1.setLabelNodes([labelNode], uow);

      expect(edge1.labelNodes).toEqual([labelNode]);
      if (doc2) expect(edge1_2!.labelNodes).toHaveLength(1);
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      expect(child.parent).toBe(edge1);
      if (doc2) expect(diagram2!.lookup(child.id)!.parent).toBe(edge1_2);
    });

    it('should append the child to the children array if no relation is provided', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      expect(edge1.children[edge1.children.length - 1]).toBe(child);
      if (doc2) expect(edge1_2!.children[edge1_2!.children.length - 1].id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);
      expect(diagram1.lookup(child.id)).toBe(child);
      if (doc2) expect(diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should be added to labelNodes if it is a label node', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);
      expect(edge1.labelNodes?.length).toBe(1);
      expect(edge1.labelNodes?.[0].node().id).toBe(child.id);
      if (doc2) {
        expect(edge1_2?.labelNodes).toHaveLength(1);
        expect(edge1_2?.labelNodes?.[0].node().id).toBe(child.id);
      }
    });

    it('should not add the child if it is already present', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);
      expect(() => edge1.addChild(child, uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      const child = layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const otherEdge = otherDiagram.newLayer().addEdge();
      expect(() => otherEdge.addChild(child, uow)).toThrow();
    });

    it('should fail is the child is an edge', () => {
      const child = layer1.addEdge();
      expect(() => edge1.addChild(child, uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);
      edge1.removeChild(child, uow);
      expect(edge1.children.length).toBe(0);
      if (doc2) expect(edge1_2!.children.length).toBe(0);
    });

    it('should remove the child from the labelNodes array if it is a label node', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);
      edge1.removeChild(child, uow);
      expect(edge1.labelNodes?.length).toBe(0);
      if (doc2) expect(edge1_2?.labelNodes?.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      const child = layer1.createNode();
      expect(() => edge1.removeChild(child, uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      resetUow();
      edge1.removeChild(child, uow);
      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();
      edge1.setChildren([child1, child2], uow);
      expect(edge1.children).toEqual([child1, child2]);
      if (doc2) expect(edge1_2?.children).toHaveLength(2);
    });

    it('should remove all children from the previous set', () => {
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();
      edge1.addChild(child1, uow);
      edge1.addChild(child2, uow);

      resetUow();
      edge1.setChildren([child1], uow);
      expect(edge1.children).toEqual([child1]);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);

      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child1, 'update')).toBe(true);
      expect(uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setLabelNodes', () => {
    it('should set the label nodes correctly', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.setLabelNodes([labelNode], uow);
      expect(edge1.labelNodes).toEqual([labelNode]);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(1);
    });

    it('should remove all label nodes from the previous set', () => {
      const labelNode1 = layer1.createNode().asLabelNode();
      const labelNode2 = layer1.createNode().asLabelNode();
      edge1.setLabelNodes([labelNode1, labelNode2], uow);
      expect(edge1.labelNodes).toEqual([labelNode1, labelNode2]);
      expect(edge1.labelNodes?.length).toBe(2);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(2);

      edge1.setLabelNodes([labelNode1], uow);
      expect(edge1.labelNodes).toEqual([labelNode1]);
      expect(edge1.labelNodes?.length).toBe(1);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(1);
    });

    it('should remove update children', () => {
      const labelNode1 = layer1.createNode().asLabelNode();
      const labelNode2 = layer1.createNode().asLabelNode();
      edge1.setLabelNodes([labelNode1, labelNode2], uow);
      expect(edge1.children).toEqual([labelNode1.node(), labelNode2.node()]);
      expect(edge1.children?.length).toBe(2);
      if (doc2) expect(edge1_2?.children).toHaveLength(2);

      edge1.setLabelNodes([labelNode1], uow);
      expect(edge1.children).toEqual([labelNode1.node()]);
      expect(edge1.children?.length).toBe(1);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);
    });
  });

  describe('addLabelNode', () => {
    it('should add the label node to the label nodes array', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, uow);
      expect(edge1.labelNodes).toEqual([labelNode]);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(1);
    });

    it('should update the label node in the UnitOfWork', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, uow);
      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(labelNode.node(), 'update')).toBe(true);
    });

    it('should fail if the label node is already present', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, uow);
      expect(() => edge1.addLabelNode(labelNode, uow)).toThrow();
    });

    it('should update children', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addChild(labelNode.node(), uow);
      expect(edge1.children).toEqual([labelNode.node()]);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);
    });
  });

  describe('removeLabelNode', () => {
    it('should remove the label node from the label nodes array', () => {
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, uow);
      edge1.removeLabelNode(labelNode, uow);
      expect(edge1.labelNodes).toHaveLength(0);
      expect(edge1.children).toHaveLength(0);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(0);
      if (doc2) expect(edge1_2?.children).toHaveLength(0);
    });

    it('should fail if the label node is not present', () => {
      const labelNode = layer1.createNode().asLabelNode();
      expect(() => edge1.removeLabelNode(labelNode, uow)).toThrow();
    });
  });
});
