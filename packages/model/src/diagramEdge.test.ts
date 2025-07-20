import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint, FreeEndpoint } from './endpoint';
import { TestDiagramBuilder, TestLayerBuilder, TestModel } from './test-support/builder';
import { type Backend, Backends } from './collaboration/yjs/collaborationTestUtils';
import type { DiagramDocument } from './diagramDocument';
import { DiagramEdge } from './diagramEdge';
import type { Diagram } from './diagram';

describe.each(Backends.all())('DiagramEdge [%s]', (_name, backend) => {
  let diagram1: TestDiagramBuilder;
  let layer1: TestLayerBuilder;
  let uow: UnitOfWork;
  let edge1: DiagramEdge;

  let edge1_2: DiagramEdge | undefined;
  let doc2: DiagramDocument | undefined;
  let diagram2: Diagram | undefined;

  let elementChange: ReturnType<Backend['createFns']>;

  beforeEach(() => {
    backend.beforeEach();

    const [root1, root2] = backend.syncedDocs();

    diagram1 = TestModel.newDiagram(root1);
    layer1 = diagram1.newLayer();

    doc2 = root2 ? TestModel.newDocument(root2) : undefined;

    uow = UnitOfWork.immediate(diagram1);
    edge1 = layer1.addEdge();

    diagram2 = doc2?.topLevelDiagrams?.[0];
    edge1_2 = diagram2?.lookup(edge1.id) as DiagramEdge | undefined;

    elementChange = backend.createFns();
    diagram1.on('elementChange', elementChange[0]);
    if (diagram2) diagram2.on('elementChange', elementChange[1]);
  });
  afterEach(backend.afterEach);

  const resetUow = () => (uow = UnitOfWork.immediate(diagram1));

  describe('name', () => {
    it('should return the name from the first label node if label nodes exist', () => {
      // **** Act
      const node = layer1.addNode();
      UnitOfWork.execute(diagram1, uow => node.setText('LabelNodeName', uow));

      // **** Verify
      expect(node.getText()).toBe('LabelNodeName');
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(diagram2!.nodeLookup.get(node.id)?.getText()).toBe('LabelNodeName');
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }

      // Setup
      elementChange[0].mockReset();
      elementChange[1].mockReset();

      // **** Act
      const labelNode = node.asLabelNode();
      UnitOfWork.execute(diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.name).toBe('LabelNodeName');
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(edge1_2?.name).toBe('LabelNodeName');
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });

    it('should return the metadata name if no label nodes and metadata name is set', () => {
      // **** Act
      UnitOfWork.execute(diagram1, uow =>
        edge1.updateMetadata(props => {
          props.name = 'MetadataName';
          return props;
        }, uow)
      );

      // **** Verify
      expect(edge1.name).toBe('MetadataName');
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(edge1_2?.name).toBe('MetadataName');
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should return the concatenated names of connected nodes if no label nodes or metadata name', () => {
      const start = layer1.addNode();
      start.setText('StartNode', uow);

      const end = layer1.addNode();
      end.setText('EndNode', uow);

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.setStart(new AnchorEndpoint(start, 'c'), uow));
      UnitOfWork.execute(diagram1, uow => edge1.setEnd(new AnchorEndpoint(end, 'c'), uow));

      // **** Verify
      expect(edge1.name).toBe('StartNode - EndNode');
      expect(elementChange[0]).toHaveBeenCalledTimes(4);
      if (doc2) {
        expect(edge1_2?.name).toBe('StartNode - EndNode');
        expect(elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should return the edge id if no label nodes, metadata name, or connected node names', () => {
      // **** Verify
      expect(edge1.name).toBe(edge1.id);
      if (doc2) expect(edge1_2?.name).toBe(edge1.id);
    });
  });

  describe('bounds', () => {
    it('should return a box defined by the start and end positions', () => {
      // **** Setup
      const startNode = layer1.addNode();
      startNode.setBounds({ x: 10, y: 20, w: 10, h: 10, r: 0 }, uow);

      const endNode = layer1.addNode();
      endNode.setBounds({ x: 100, y: 200, w: 10, h: 10, r: 0 }, uow);

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.setStart(new AnchorEndpoint(startNode, 'c'), uow));
      UnitOfWork.execute(diagram1, uow => edge1.setEnd(new AnchorEndpoint(endNode, 'c'), uow));

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
      expect(elementChange[0]).toHaveBeenCalledTimes(4);
      if (doc2) {
        expect(edge1_2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
        expect(elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should trigger an elementChange event', () => {
      // **** Setup
      edge1.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge1.setEnd(new FreeEndpoint({ x: 10, y: 10 }), uow);

      // **** Act
      UnitOfWork.execute(diagram1, uow =>
        edge1.setBounds({ x: 15, y: 25, w: 90, h: 180, r: 0 }, uow)
      );

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(edge1_2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });

        // TODO: Why is there 4 events here
        expect(elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });
  });

  describe('labelNodes', () => {
    it('should return empty array when no label nodes are set', () => {
      // **** Verify
      expect(edge1.labelNodes).toEqual([]);
      if (doc2) expect(edge1_2!.labelNodes).toEqual([]);
    });

    it('should return correct label nodes after setting them', () => {
      // **** Setup
      const labelNode = layer1.addNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(edge1_2!.labelNodes).toHaveLength(1);

        // TODO: Why is there 3 calls here and not 2
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      // **** Act
      const child = layer1.createNode();
      UnitOfWork.execute(diagram1, uow => edge1.addChild(child, uow));

      expect(child.parent).toBe(edge1);
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(diagram2!.lookup(child.id)!.parent).toBe(edge1_2);

        // TODO: Why is there 3 calls here and not 2
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });

    it('should append the child to the children array if no relation is provided', () => {
      // **** Act
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Verify
      expect(edge1.children[edge1.children.length - 1]).toBe(child);
      if (doc2) expect(edge1_2!.children[edge1_2!.children.length - 1].id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Act
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Verify
      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      // **** Act
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Verify
      expect(diagram1.lookup(child.id)).toBe(child);
      if (doc2) expect(diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should be added to labelNodes if it is a label node', () => {
      // **** Act
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(1);
      expect(edge1.labelNodes?.[0].node().id).toBe(child.id);
      if (doc2) {
        expect(edge1_2?.labelNodes).toHaveLength(1);
        expect(edge1_2?.labelNodes?.[0].node().id).toBe(child.id);
      }
    });

    it('should not add the child if it is already present', () => {
      // **** Act
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Verify
      expect(() => edge1.addChild(child, uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      // **** Act
      const child = layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const otherEdge = otherDiagram.newLayer().addEdge();

      // **** Verify
      expect(() => otherEdge.addChild(child, uow)).toThrow();
    });

    it('should fail is the child is an edge', () => {
      // **** Act
      const child = layer1.addEdge();

      // **** Verify
      expect(() => edge1.addChild(child, uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      // **** Setup
      const elementRemove = backend.createFns();
      diagram1.on('elementRemove', elementRemove[0]);
      if (diagram2) diagram2.on('elementRemove', elementRemove[1]);

      const child = layer1.createNode();
      edge1.addChild(child, uow);

      elementChange[0].mockReset();
      elementChange[1].mockReset();

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.removeChild(child, uow));

      // **** Verify
      expect(edge1.children.length).toBe(0);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(edge1_2!.children.length).toBe(0);
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
        expect(elementRemove[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should remove the child from the labelNodes array if it is a label node', () => {
      // **** Setup
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Act
      edge1.removeChild(child, uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(0);
      if (doc2) expect(edge1_2?.labelNodes?.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      // **** Verify
      const child = layer1.createNode();
      expect(() => edge1.removeChild(child, uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Setup
      const child = layer1.createNode();
      edge1.addChild(child, uow);

      // **** Act
      resetUow();
      edge1.removeChild(child, uow);

      // **** Verify
      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      // **** Setup
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.setChildren([child1, child2], uow));

      // **** Verify
      expect(edge1.children).toEqual([child1, child2]);
      expect(elementChange[0]).toHaveBeenCalledTimes(3);
      if (doc2) {
        expect(edge1_2?.children).toHaveLength(2);

        // TODO: Why 6 times and not 3
        expect(elementChange[1]).toHaveBeenCalledTimes(6);
      }
    });

    it('should remove all children from the previous set', () => {
      // **** Setup
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();
      edge1.addChild(child1, uow);
      edge1.addChild(child2, uow);

      // **** Act
      resetUow();
      edge1.setChildren([child1], uow);

      // **** Verify
      expect(edge1.children).toEqual([child1]);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);

      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(child1, 'update')).toBe(true);
      expect(uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setLabelNodes', () => {
    it('should set the label nodes correctly', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(edge1_2?.labelNodes).toHaveLength(1);

        // TODO: Why 3 and not 2
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });

    it('should remove all label nodes from the previous set', () => {
      // **** Setup
      const labelNode1 = layer1.createNode().asLabelNode();
      const labelNode2 = layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1, labelNode2]);
      expect(edge1.labelNodes?.length).toBe(2);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1]);
      expect(edge1.labelNodes?.length).toBe(1);
      if (doc2) expect(edge1_2?.labelNodes).toHaveLength(1);
    });

    it('should remove update children', () => {
      // **** Setup
      const labelNode1 = layer1.createNode().asLabelNode();
      const labelNode2 = layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node(), labelNode2.node()]);
      expect(edge1.children?.length).toBe(2);
      if (doc2) expect(edge1_2?.children).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node()]);
      expect(edge1.children?.length).toBe(1);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);
    });
  });

  describe('addLabelNode', () => {
    it('should add the label node to the label nodes array', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.addLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(edge1_2?.labelNodes).toHaveLength(1);

        // TODO: Why 3 and not 2
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });

    it('should update the label node in the UnitOfWork', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, uow);

      // **** Verify
      expect(uow.contains(edge1, 'update')).toBe(true);
      expect(uow.contains(labelNode.node(), 'update')).toBe(true);
    });

    it('should fail if the label node is already present', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, uow);

      // **** Verify
      expect(() => edge1.addLabelNode(labelNode, uow)).toThrow();
    });

    it('should update children', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      edge1.addChild(labelNode.node(), uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode.node()]);
      if (doc2) expect(edge1_2?.children).toHaveLength(1);
    });
  });

  describe('removeLabelNode', () => {
    it('should remove the label node from the label nodes array', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, uow);

      const elementChange = backend.createFns();
      diagram1.on('elementChange', elementChange[0]);
      if (diagram2) diagram2.on('elementChange', elementChange[1]);

      // **** Act
      UnitOfWork.execute(diagram1, uow => edge1.removeLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toHaveLength(0);
      expect(edge1.children).toHaveLength(0);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(edge1_2?.labelNodes).toHaveLength(0);
        expect(edge1_2?.children).toHaveLength(0);
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail if the label node is not present', () => {
      // **** Setup
      const labelNode = layer1.createNode().asLabelNode();

      // **** Act
      // **** Verify
      expect(() => edge1.removeLabelNode(labelNode, uow)).toThrow();
    });
  });
});
