import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import {
  TestDiagramBuilder,
  TestDiagramNodeBuilder,
  TestLayerBuilder,
  TestModel
} from './test-support/builder';
import { Backends, standardTestModel } from './collaboration/yjs/collaborationTestUtils';
import type { DiagramNode } from './diagramNode';
import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import { serializeDiagram } from './serialization/serialize';
import { commitWithUndo } from './diagramUndoActions';
import { AnchorEndpoint, FreeEndpoint } from './endpoint';
import type { DiagramEdge } from './diagramEdge';

describe.each(Backends.all())('DiagramNode [%s]', (_name, backend) => {
  let diagram1: TestDiagramBuilder;
  let layer1: TestLayerBuilder;
  let uow: UnitOfWork;
  let node1: TestDiagramNodeBuilder;

  let node2: DiagramNode | undefined;
  let doc2: DiagramDocument | undefined;
  let diagram2: Diagram | undefined;

  const resetUow = () => (uow = UnitOfWork.immediate(diagram1));

  let elementChange: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>];

  beforeEach(() => {
    backend.beforeEach();

    const model = standardTestModel(backend);
    diagram1 = model.diagram1;
    layer1 = model.layer1;
    diagram2 = model.diagram2;
    doc2 = model.doc2;
    elementChange = model.elementChange;

    node1 = layer1.addNode();
    node2 = diagram2?.lookup(node1.id) as DiagramNode | undefined;

    uow = UnitOfWork.immediate(diagram1);
  });
  afterEach(backend.afterEach);

  describe('bounds', () => {
    it('simple node only - should set bounds correctly', () => {
      // Act
      UnitOfWork.execute(diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(node2?.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('simple node only - should undo correctly', () => {
      // Setup
      const ref1 = serializeDiagram(diagram1);
      const ref2 = doc2 ? serializeDiagram(diagram2!) : undefined;

      const uow2 = new UnitOfWork(diagram1, true, false);
      node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow2);
      commitWithUndo(uow2, 'Move');

      // Act
      diagram1.undoManager.undo();

      // Verify
      expect(serializeDiagram(diagram1)).toEqual(ref1);
      if (doc2) expect(serializeDiagram(diagram2!)).toEqual(ref2);
    });

    it('connected node - should set bounds correctly', () => {
      // Setup
      const edge1 = layer1.addEdge();
      edge1.setStart(new AnchorEndpoint(node1, 'c'), uow);
      edge1.setEnd(new FreeEndpoint({ x: -100, y: -100 }), uow);

      const edge2 = doc2 ? (diagram2!.edgeLookup.get(edge1.id)! as DiagramEdge) : undefined;

      // Act
      UnitOfWork.execute(diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(edge1.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
      expect(node1.listEdges()).toContain(edge1);
      expect(edge1.start).toBeInstanceOf(AnchorEndpoint);
      expect((edge1.start as AnchorEndpoint).node).toBe(node1);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);

      if (doc2) {
        expect(node2!.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(edge2!.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
        expect(node2!.listEdges()).toContain(edge2);
        expect(edge2!.start).toBeInstanceOf(AnchorEndpoint);
        expect((edge2!.start as AnchorEndpoint).node).toBe(node2);

        // TODO: Why 3 and not 1
        expect(elementChange[1]).toHaveBeenCalledTimes(3);
      }
    });

    it('connected node - should undo correctly', () => {
      // Setup
      const edge1 = layer1.addEdge();
      edge1.setStart(new AnchorEndpoint(node1, 'c'), uow);
      edge1.setEnd(new FreeEndpoint({ x: -100, y: -100 }), uow);

      const edge2 = doc2 ? (diagram2!.edgeLookup.get(edge1.id)! as DiagramEdge) : undefined;

      const ref1 = serializeDiagram(diagram1);
      const ref2 = doc2 ? serializeDiagram(diagram2!) : undefined;

      const uow2 = new UnitOfWork(diagram1, true, false);
      node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow2);
      commitWithUndo(uow2, 'Move');

      // Act
      diagram1.undoManager.undo();

      // Verify
      expect(serializeDiagram(diagram1)).toEqual(ref1);
      expect(node1.listEdges()).toContain(edge1);
      expect(edge1.start).toBeInstanceOf(AnchorEndpoint);
      expect((edge1.start as AnchorEndpoint).node).toBe(node1);

      if (doc2) {
        expect(serializeDiagram(diagram2!)).toEqual(ref2);
        expect(node2!.listEdges()).toContain(edge2);
        expect(edge2!.start).toBeInstanceOf(AnchorEndpoint);
        expect((edge2!.start as AnchorEndpoint).node).toBe(node2);
      }

      // Act
      UnitOfWork.execute(diagram1, uow =>
        node1.setBounds({ w: 100, h: 100, x: 20, y: 20, r: 0 }, uow)
      );

      // Verify
      expect(node1.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
      expect(edge1.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });

      if (doc2) {
        expect(node2!.bounds).toEqual({ w: 100, h: 100, x: 20, y: 20, r: 0 });
        expect(edge2!.bounds).toEqual({ x: -100, y: -100, w: 170, h: 170, r: 0 });
      }
    });
  });

  describe('detachCRDT', () => {
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

  describe('isLabelNode', () => {
    it('should return true when the parent is an edge', () => {
      const edge = layer1.addEdge();
      node1._setParent(edge);

      expect(node1.isLabelNode()).toBe(true);
      if (doc2) expect(node2?.isLabelNode()).toBe(true);
    });

    it('should return false when the parent is not an edge', () => {
      const anotherNode = layer1.addNode();
      node1._setParent(anotherNode);

      expect(node1.isLabelNode()).toBe(false);
      if (doc2) expect(node2?.isLabelNode()).toBe(false);
    });

    it('should return false when there is no parent', () => {
      node1._setParent(undefined);

      expect(node1.isLabelNode()).toBe(false);
      if (doc2) expect(node2?.isLabelNode()).toBe(false);
    });
  });

  describe('labelNode', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = layer1.addNode();
      node1._setParent(anotherNode);

      expect(node1.labelNode()).toBeUndefined();
      if (doc2) expect(node2?.labelNode()).toBeUndefined();
    });

    it('should return the corresponding label node when the node is a label node', () => {
      const edge = layer1.addEdge();

      const labelNode = node1.asLabelNode();
      edge.setLabelNodes([labelNode], uow);

      expect(node1.labelNode()!.node()).toEqual(node1);
      if (doc2) expect(node2?.labelNode()!.node().id).toBe(node1.id);
    });
  });

  describe('labelEdge', () => {
    it('should return undefined when the node is not a label node', () => {
      const anotherNode = layer1.createNode();
      node1._setParent(anotherNode);

      expect(node1.labelEdge()).toBeUndefined();
      if (doc2) expect(node2?.labelEdge()).toBeUndefined();
    });

    it('should return the associated edge when the node is a label node', () => {
      const edge = layer1.addEdge();
      node1._setParent(edge);

      expect(node1.labelEdge()).toBe(edge);
      if (doc2) expect(node2?.labelEdge()?.id).toBe(edge.id);
    });
  });

  describe('name', () => {
    it('should return "nodeType / id" when no metadata name or text is available', () => {
      node1.updateMetadata(metadata => (metadata.name = ''), uow);
      node1.setText('', uow);

      expect(node1.name).toBe(`${node1.nodeType} / ${node1.id}`);
      if (doc2) expect(node2?.name).toBe(`${node1.nodeType} / ${node1.id}`);
    });

    it('should return metadata name if set', () => {
      const customName = 'Custom Node Name';
      node1.updateMetadata(metadata => (metadata.name = customName), uow);

      expect(node1.name).toBe(customName);
      if (doc2) expect(node2?.name).toBe(customName);
    });

    it('should format name based on text template if text is available', () => {
      node1.setText('Hello, %value%!', uow);
      node1.updateMetadata(metadata => (metadata.data = { customData: { value: 'Node1' } }), uow);

      expect(node1.name).toBe('Hello, Node1!');
      if (doc2) expect(node2?.name).toBe('Hello, Node1!');
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      // **** Setup
      const child = layer1.createNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => node1.addChild(child, uow));

      // **** Verify
      expect(child.parent).toBe(node1);
      expect(elementChange[0]).toHaveBeenCalledTimes(2);
      if (doc2) {
        expect(diagram2!.lookup(child.id)!.parent).toBe(node2);
        expect(elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should append the child to the children array if no relation is provided', () => {
      const child = layer1.createNode();
      node1.addChild(child, uow);

      expect(node1.children[node1.children.length - 1]).toBe(child);
      if (doc2) expect(node2!.children[node2!.children.length - 1].id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer1.createNode();
      node1.addChild(child, uow);

      expect(uow.contains(node1, 'update')).toBe(true);
      expect(uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      const child = layer1.createNode();
      node1.addChild(child, uow);
      expect(diagram1.lookup(child.id)).toBe(child);
      if (doc2) expect(diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should not add the child if it is already present', () => {
      const child = layer1.createNode();
      node1.addChild(child, uow);
      expect(() => node1.addChild(child, uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      const child = layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const other = otherDiagram.newLayer().createNode();
      expect(() => other.addChild(child, uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      // **** Setup
      const child = layer1.createNode();
      node1.addChild(child, uow);

      const elementRemove = [vi.fn(), vi.fn()];
      diagram1.on('elementRemove', elementRemove[0]);
      if (diagram2) diagram2.on('elementRemove', elementRemove[1]);

      // **** Act
      UnitOfWork.execute(diagram1, uow => node1.removeChild(child, uow));

      // **** Verify
      expect(node1.children.length).toBe(0);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(node2!.children.length).toBe(0);
        expect(elementChange[0]).toHaveBeenCalledTimes(1);
        expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail if the child is not present', () => {
      const child = layer1.createNode();
      expect(() => node1.removeChild(child, uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      const child = layer1.createNode();
      node1.addChild(child, uow);

      resetUow();
      node1.removeChild(child, uow);
      expect(uow.contains(node1, 'update')).toBe(true);
      expect(uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      // **** Setup
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();

      // **** Act
      UnitOfWork.execute(diagram1, uow => node1.setChildren([child1, child2], uow));

      // **** Verify
      expect(node1.children).toEqual([child1, child2]);
      expect(elementChange[0]).toHaveBeenCalledTimes(3);
      if (doc2) {
        expect(node2!.children.map(c => c.id)).toEqual([child1.id, child2.id]);

        // TODO: Why 4 and not 3
        expect(elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should remove all children from the previous set', () => {
      const child1 = layer1.createNode();
      const child2 = layer1.createNode();
      node1.addChild(child1, uow);
      node1.addChild(child2, uow);

      resetUow();
      node1.setChildren([child1], uow);
      expect(node1.children).toEqual([child1]);
      if (doc2) expect(node2!.children.map(c => c.id)).toEqual([child1.id]);

      expect(uow.contains(node1, 'update')).toBe(true);
      expect(uow.contains(child1, 'update')).toBe(true);
      expect(uow.contains(child2, 'remove')).toBe(true);
    });
  });
});
