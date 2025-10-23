import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { TestDiagramNodeBuilder, TestModel } from './test-support/builder';
import {
  type StandardTestModel,
  standardTestModel
} from './test-support/collaborationModelTestUtils';
import type { DiagramNode } from './diagramNode';
import { serializeDiagram } from './serialization/serialize';
import { commitWithUndo } from './diagramUndoActions';
import { AnchorEndpoint, FreeEndpoint } from './endpoint';
import type { DiagramEdge } from './diagramEdge';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DiagramNode [%s]', (_name, backend) => {
  let node1: TestDiagramNodeBuilder;
  let node2: DiagramNode | undefined;
  let model: StandardTestModel;

  const resetUow = () => (model.uow = UnitOfWork.immediate(model.diagram1));

  beforeEach(() => {
    backend.beforeEach();

    model = standardTestModel(backend);

    node1 = model.layer1.addNode();
    node2 = model.diagram2?.lookup(node1.id) as DiagramNode | undefined;
  });
  afterEach(backend.afterEach);

  describe('bounds', () => {
    it('simple node only - should set bounds correctly', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(node2?.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('simple node only - should undo correctly', () => {
      // Setup
      const ref1 = serializeDiagram(model.diagram1);
      const ref2 = model.doc2 ? serializeDiagram(model.diagram2!) : undefined;

      const uow2 = new UnitOfWork(model.diagram1, true, false);
      node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow2);
      commitWithUndo(uow2, 'Move');

      // Act
      model.diagram1.undoManager.undo();

      // Verify
      expect(serializeDiagram(model.diagram1)).toEqual(ref1);
      if (model.doc2) expect(serializeDiagram(model.diagram2!)).toEqual(ref2);
    });

    it('connected node - should set bounds correctly', () => {
      // Setup
      const edge1 = model.layer1.addEdge();
      edge1.setStart(new AnchorEndpoint(node1, 'c'), model.uow);
      edge1.setEnd(new FreeEndpoint({ x: -100, y: -100 }), model.uow);

      const edge2 = model.doc2
        ? (model.diagram2!.edgeLookup.get(edge1.id)! as DiagramEdge)
        : undefined;

      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(edge1.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
      expect(node1.edges).toContain(edge1);
      expect(edge1.start).toBeInstanceOf(AnchorEndpoint);
      expect((edge1.start as AnchorEndpoint).node).toBe(node1);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      if (model.doc2) {
        expect(node2!.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(edge2!.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
        expect(node2!.edges).toContain(edge2);
        expect(edge2!.start).toBeInstanceOf(AnchorEndpoint);
        expect((edge2!.start as AnchorEndpoint).node).toBe(node2);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('connected node - should undo correctly', () => {
      // Setup
      const edge1 = model.layer1.addEdge();
      edge1.setStart(new AnchorEndpoint(node1, 'c'), model.uow);
      edge1.setEnd(new FreeEndpoint({ x: -100, y: -100 }), model.uow);

      const edge2 = model.doc2
        ? (model.diagram2!.edgeLookup.get(edge1.id)! as DiagramEdge)
        : undefined;

      const ref1 = serializeDiagram(model.diagram1);
      const ref2 = model.doc2 ? serializeDiagram(model.diagram2!) : undefined;

      const uow2 = new UnitOfWork(model.diagram1, true, false);
      node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow2);
      commitWithUndo(uow2, 'Move');

      // Act
      model.diagram1.undoManager.undo();

      // Verify
      expect(serializeDiagram(model.diagram1)).toEqual(ref1);
      expect(node1.edges).toContain(edge1);
      expect(edge1.start).toBeInstanceOf(AnchorEndpoint);
      expect((edge1.start as AnchorEndpoint).node).toBe(node1);

      if (model.doc2) {
        expect(serializeDiagram(model.diagram2!)).toEqual(ref2);
        expect(node2!.edges).toContain(edge2);
        expect(edge2!.start).toBeInstanceOf(AnchorEndpoint);
        expect((edge2!.start as AnchorEndpoint).node).toBe(node2);
      }

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(edge1.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });

      if (model.doc2) {
        expect(node2!.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(edge2!.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
      }
    });
  });

  describe('detachCRDT', () => {
    it('text is kept when detaching', () => {
      const node = model.layer1.addNode();
      node.setText('LabelNodeName', model.uow);

      expect(node.getText()).toBe('LabelNodeName');
      if (model.doc2) {
        const n = model.doc2.diagrams[0]!.lookup(node.id) as DiagramNode;
        expect(n.getText()).toBe('LabelNodeName');
      }

      node.detachCRDT();

      expect(node.getText()).toBe('LabelNodeName');
      if (model.doc2) {
        const n = model.doc2.diagrams[0]!.lookup(node.id) as DiagramNode;
        expect(n.getText()).toBe('LabelNodeName');
      }
    });
  });

  describe('isLabelNode', () => {
    it('should return true when the parent is an edge', () => {
      const edge = model.layer1.addEdge();
      node1._setParent(edge);

      expect(node1.isLabelNode()).toBe(true);
      if (model.doc2) expect(node2?.isLabelNode()).toBe(true);
    });

    it('should return false when the parent is not an edge', () => {
      const anotherNode = model.layer1.addNode();
      node1._setParent(anotherNode);

      expect(node1.isLabelNode()).toBe(false);
      if (model.doc2) expect(node2?.isLabelNode()).toBe(false);
    });

    it('should return false when there is no parent', () => {
      node1._setParent(undefined);

      expect(node1.isLabelNode()).toBe(false);
      if (model.doc2) expect(node2?.isLabelNode()).toBe(false);
    });
  });

  describe('labelNode', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = model.layer1.addNode();
      node1._setParent(anotherNode);

      expect(node1.labelNode()).toBeUndefined();
      if (model.doc2) expect(node2?.labelNode()).toBeUndefined();
    });

    it('should return the corresponding label node when the node is a label node', () => {
      const edge = model.layer1.addEdge();

      const labelNode = node1.asLabelNode();
      edge.setLabelNodes([labelNode], model.uow);

      expect(node1.labelNode()!.node()).toEqual(node1);
      if (model.doc2) expect(node2?.labelNode()!.node().id).toBe(node1.id);
    });
  });

  describe('labelEdge', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = model.layer1.createNode();
      node1._setParent(anotherNode);

      expect(node1.labelEdge()).toBeUndefined();
      if (model.doc2) expect(node2?.labelEdge()).toBeUndefined();
    });

    it('should return the associated edge when the node is a label node', () => {
      const edge = model.layer1.addEdge();
      node1._setParent(edge);

      expect(node1.labelEdge()).toBe(edge);
      if (model.doc2) expect(node2?.labelEdge()?.id).toBe(edge.id);
    });
  });

  describe('name', () => {
    it('should return "nodeType / id" when no metadata name or text is available', () => {
      node1.updateMetadata(metadata => (metadata.name = ''), model.uow);
      node1.setText('', model.uow);

      expect(node1.name).toBe(`${node1.nodeType} / ${node1.id}`);
      if (model.doc2) expect(node2?.name).toBe(`${node1.nodeType} / ${node1.id}`);
    });

    it('should return metadata name if set', () => {
      const customName = 'Custom Node Name';
      node1.updateMetadata(metadata => (metadata.name = customName), model.uow);

      expect(node1.name).toBe(customName);
      if (model.doc2) expect(node2?.name).toBe(customName);
    });

    it('should format name based on text template if text is available', () => {
      node1.setText('Hello, %value%!', model.uow);
      node1.updateMetadata(
        metadata => (metadata.data = { customData: { value: 'Node1' } }),
        model.uow
      );

      expect(node1.name).toBe('Hello, Node1!');
      if (model.doc2) expect(node2?.name).toBe('Hello, Node1!');
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      // **** Setup
      const child = model.layer1.createNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => node1.addChild(child, uow));

      // **** Verify
      expect(child.parent).toBe(node1);

      // TODO: Why is this 2 and not 1
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);

      // TODO: Why is this 0 and not 1
      expect(model.elementAdd[0]).toHaveBeenCalledTimes(0);
      if (model.doc2) {
        expect(model.diagram2!.lookup(child.id)!.parent).toBe(node2);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);

        // TODO: Why is this 2 and not 1
        expect(model.elementAdd[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should append the child to the children array if no relation is provided', () => {
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);

      expect(node1.children[node1.children.length - 1]).toBe(child);
      if (model.doc2) expect(node2!.children[node2!.children.length - 1]!.id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);

      expect(model.uow.contains(node1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);
      expect(model.diagram1.lookup(child.id)).toBe(child);
      if (model.doc2) expect(model.diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should not add the child if it is already present', () => {
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);
      expect(() => node1.addChild(child, model.uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      const child = model.layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const other = otherDiagram.newLayer().createNode();
      expect(() => other.addChild(child, model.uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      // **** Setup
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);

      const elementRemove = [vi.fn(), vi.fn()];
      model.diagram1.on('elementRemove', elementRemove[0]!);
      if (model.diagram2) model.diagram2.on('elementRemove', elementRemove[1]!);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => node1.removeChild(child, uow));

      // **** Verify
      expect(node1.children.length).toBe(0);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(node2!.children.length).toBe(0);
        expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
        expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail if the child is not present', () => {
      const child = model.layer1.createNode();
      expect(() => node1.removeChild(child, model.uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = model.layer1.createNode();
      node1.addChild(child, model.uow);

      resetUow();
      node1.removeChild(child, model.uow);
      expect(model.uow.contains(node1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      // **** Setup
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => node1.setChildren([child1, child2], uow));

      // **** Verify
      expect(node1.children).toEqual([child1, child2]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(3);
      if (model.doc2) {
        expect(node2!.children.map(c => c.id)).toEqual([child1.id, child2.id]);

        // TODO: Why 2 and not 3
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should remove all children from the previous set', () => {
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();
      node1.addChild(child1, model.uow);
      node1.addChild(child2, model.uow);

      resetUow();
      node1.setChildren([child1], model.uow);
      expect(node1.children).toEqual([child1]);
      if (model.doc2) expect(node2!.children.map(c => c.id)).toEqual([child1.id]);

      expect(model.uow.contains(node1, 'update')).toBe(true);
      expect(model.uow.contains(child1, 'update')).toBe(true);
      expect(model.uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setText', () => {
    it('should set text', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow => node1.setText('Hello', uow));

      // Verify
      expect(node1.getText()).toBe('Hello');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(node2!.getText()).toBe('Hello');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should set alternate text', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow => node1.setText('Hello', uow, 'alt'));

      // Verify
      expect(node1.getText('alt')).toBe('Hello');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(node2!.getText('alt')).toBe('Hello');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('updateProps', () => {
    it('should set props correctly', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        node1.updateProps(props => {
          props.stroke ??= {};
          props.stroke.color = 'red';
        }, uow)
      );

      // Verify
      expect(node1.storedProps.stroke!.color).toBe('red');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (node2) {
        expect(node2.storedProps.stroke!.color).toBe('red');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('updateCustomProps', () => {
    it('should set custom props correctly', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        node1.updateCustomProps(
          'star',
          props => {
            props.numberOfSides = 20;
          },
          uow
        )
      );

      // Verify
      expect(node1.storedProps.custom!.star!.numberOfSides).toBe(20);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (node2) {
        expect(node2.storedProps.custom!.star!.numberOfSides).toBe(20);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('getAnchor', () => {
    it('should return the correct anchors', () => {
      const ref = {
        clip: true,
        id: 'c',
        start: {
          x: 0.5,
          y: 0.5
        },
        type: 'center'
      };
      expect(node1.getAnchor('c')).toEqual(ref);
      if (node2) expect(node2.getAnchor('c')).toEqual(ref);
    });
  });
});
