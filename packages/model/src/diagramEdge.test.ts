import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint, FreeEndpoint } from './endpoint';
import { TestModel } from './test-support/builder';
import {
  Backends,
  resetListeners,
  standardTestModel,
  type StandardTestModel
} from './collaboration/yjs/collaborationTestUtils';
import { DiagramEdge } from './diagramEdge';

describe.each(Backends.all())('DiagramEdge [%s]', (_name, backend) => {
  let edge1: DiagramEdge;
  let edge2: DiagramEdge | undefined;
  let model: StandardTestModel;

  beforeEach(() => {
    backend.beforeEach();

    model = standardTestModel(backend);

    edge1 = model.layer1.addEdge();

    edge2 = model.diagram2?.lookup(edge1.id) as DiagramEdge | undefined;
  });
  afterEach(backend.afterEach);

  const resetUow = () => (model.uow = UnitOfWork.immediate(model.diagram1));

  describe('name', () => {
    it('should return the name from the first label node if label nodes exist', () => {
      // **** Act
      const node = model.layer1.addNode();
      UnitOfWork.execute(model.diagram1, uow => node.setText('LabelNodeName', uow));

      // **** Verify
      expect(node.getText()).toBe('LabelNodeName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(model.diagram2!.nodeLookup.get(node.id)?.getText()).toBe('LabelNodeName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }

      // Setup
      model.reset();

      // **** Act
      const labelNode = node.asLabelNode();
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.name).toBe('LabelNodeName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.name).toBe('LabelNodeName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should return the metadata name if no label nodes and metadata name is set', () => {
      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.updateMetadata(props => {
          props.name = 'MetadataName';
          return props;
        }, uow)
      );

      // **** Verify
      expect(edge1.name).toBe('MetadataName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2?.name).toBe('MetadataName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should return the concatenated names of connected nodes if no label nodes or metadata name', () => {
      const start = model.layer1.addNode();
      start.setText('StartNode', model.uow);

      const end = model.layer1.addNode();
      end.setText('EndNode', model.uow);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new AnchorEndpoint(start, 'c'), uow)
      );
      UnitOfWork.execute(model.diagram1, uow => edge1.setEnd(new AnchorEndpoint(end, 'c'), uow));

      // **** Verify
      expect(edge1.name).toBe('StartNode - EndNode');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2?.name).toBe('StartNode - EndNode');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should return the edge id if no label nodes, metadata name, or connected node names', () => {
      // **** Verify
      expect(edge1.name).toBe(edge1.id);
      if (model.doc2) expect(edge2?.name).toBe(edge1.id);
    });
  });

  describe('bounds', () => {
    it('should return a box defined by the start and end positions', () => {
      // **** Setup
      const startNode = model.layer1.addNode();
      startNode.setBounds({ x: 10, y: 20, w: 10, h: 10, r: 0 }, model.uow);

      const endNode = model.layer1.addNode();
      endNode.setBounds({ x: 100, y: 200, w: 10, h: 10, r: 0 }, model.uow);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new AnchorEndpoint(startNode, 'c'), uow)
      );
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setEnd(new AnchorEndpoint(endNode, 'c'), uow)
      );

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should trigger an elementChange event', () => {
      // **** Setup
      edge1.setStart(new FreeEndpoint({ x: 0, y: 0 }), model.uow);
      edge1.setEnd(new FreeEndpoint({ x: 10, y: 10 }), model.uow);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setBounds({ x: 15, y: 25, w: 90, h: 180, r: 0 }, uow)
      );

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });

        // TODO: Why is there 4 events here
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });
  });

  describe('labelNodes', () => {
    it('should return empty array when no label nodes are set', () => {
      // **** Verify
      expect(edge1.labelNodes).toEqual([]);
      if (model.doc2) expect(edge2!.labelNodes).toEqual([]);
    });

    it('should return correct label nodes after setting them', () => {
      // **** Setup
      const labelNode = model.layer1.addNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2!.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      // **** Act
      const child = model.layer1.createNode();
      UnitOfWork.execute(model.diagram1, uow => edge1.addChild(child, uow));

      expect(child.parent).toBe(edge1);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(model.diagram2!.lookup(child.id)!.parent).toBe(edge2);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should append the child to the children array if no relation is provided', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(edge1.children[edge1.children.length - 1]).toBe(child);
      if (model.doc2) expect(edge2!.children[edge2!.children.length - 1].id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(model.diagram1.lookup(child.id)).toBe(child);
      if (model.doc2) expect(model.diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should be added to labelNodes if it is a label node', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(1);
      expect(edge1.labelNodes?.[0].node().id).toBe(child.id);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(edge2?.labelNodes?.[0].node().id).toBe(child.id);
      }
    });

    it('should not add the child if it is already present', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(() => edge1.addChild(child, model.uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      // **** Act
      const child = model.layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const otherEdge = otherDiagram.newLayer().addEdge();

      // **** Verify
      expect(() => otherEdge.addChild(child, model.uow)).toThrow();
    });

    it('should fail is the child is an edge', () => {
      // **** Act
      const child = model.layer1.addEdge();

      // **** Verify
      expect(() => edge1.addChild(child, model.uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      // **** Setup
      const elementRemove = [vi.fn(), vi.fn()];
      model.diagram1.on('elementRemove', elementRemove[0]);
      if (model.diagram2) model.diagram2.on('elementRemove', elementRemove[1]);

      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      resetListeners(model.elementChange);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.removeChild(child, uow));

      // **** Verify
      expect(edge1.children.length).toBe(0);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2!.children.length).toBe(0);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
        expect(elementRemove[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should remove the child from the labelNodes array if it is a label node', () => {
      // **** Setup
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Act
      edge1.removeChild(child, model.uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(0);
      if (model.doc2) expect(edge2?.labelNodes?.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      // **** Verify
      const child = model.layer1.createNode();
      expect(() => edge1.removeChild(child, model.uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Setup
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Act
      resetUow();
      edge1.removeChild(child, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      // **** Setup
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setChildren([child1, child2], uow));

      // **** Verify
      expect(edge1.children).toEqual([child1, child2]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(3);
      if (model.doc2) {
        expect(edge2?.children).toHaveLength(2);

        // TODO: Why 4 times and not 3
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should remove all children from the previous set', () => {
      // **** Setup
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();
      edge1.addChild(child1, model.uow);
      edge1.addChild(child2, model.uow);

      // **** Act
      resetUow();
      edge1.setChildren([child1], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([child1]);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);

      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child1, 'update')).toBe(true);
      expect(model.uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setLabelNodes', () => {
    it('should set the label nodes correctly', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should remove all label nodes from the previous set', () => {
      // **** Setup
      const labelNode1 = model.layer1.createNode().asLabelNode();
      const labelNode2 = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], model.uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1, labelNode2]);
      expect(edge1.labelNodes?.length).toBe(2);
      if (model.doc2) expect(edge2?.labelNodes).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], model.uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1]);
      expect(edge1.labelNodes?.length).toBe(1);
      if (model.doc2) expect(edge2?.labelNodes).toHaveLength(1);
    });

    it('should remove update children', () => {
      // **** Setup
      const labelNode1 = model.layer1.createNode().asLabelNode();
      const labelNode2 = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node(), labelNode2.node()]);
      expect(edge1.children?.length).toBe(2);
      if (model.doc2) expect(edge2?.children).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node()]);
      expect(edge1.children?.length).toBe(1);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);
    });
  });

  describe('addLabelNode', () => {
    it('should add the label node to the label nodes array', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.addLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should update the label node in the UnitOfWork', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(labelNode.node(), 'update')).toBe(true);
    });

    it('should fail if the label node is already present', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, model.uow);

      // **** Verify
      expect(() => edge1.addLabelNode(labelNode, model.uow)).toThrow();
    });

    it('should update children', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addChild(labelNode.node(), model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode.node()]);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);
    });
  });

  describe('removeLabelNode', () => {
    it('should remove the label node from the label nodes array', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, model.uow);

      const elementChange = [vi.fn(), vi.fn()];
      model.diagram1.on('elementChange', elementChange[0]);
      if (model.diagram2) model.diagram2.on('elementChange', elementChange[1]);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.removeLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toHaveLength(0);
      expect(edge1.children).toHaveLength(0);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(0);
        expect(edge2?.children).toHaveLength(0);
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail if the label node is not present', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      // **** Verify
      expect(() => edge1.removeLabelNode(labelNode, model.uow)).toThrow();
    });
  });
});
