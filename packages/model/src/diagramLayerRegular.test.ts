import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestModel } from './test-support/testModel';
import { RegularLayer } from './diagramLayerRegular';
import { UnitOfWork } from './unitOfWork';
import { Diagram } from './diagram';
import { ElementFactory } from './elementFactory';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import { standardTestModel } from '@diagram-craft/model/test-support/collaborationModelTestUtils';

describe.for(Backends.all())('RegularLayer [%s]', ([_name, backend]) => {
  beforeEach(backend.beforeEach);
  afterEach(backend.afterEach);

  describe('setElements', () => {
    it('should be possible to set elements that are already added', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const e1 = ElementFactory.emptyNode('id1', layer1);
      const e2 = ElementFactory.emptyNode('id2', layer1);
      UnitOfWork.execute(d1, uow => layer1.addElement(e1, uow));
      expect(layer1.elements).toHaveLength(1);

      UnitOfWork.execute(d1, uow => layer1.setElements([e1], uow));
      expect(layer1.elements).toHaveLength(1);

      UnitOfWork.execute(d1, uow => layer1.setElements([], uow));
      expect(layer1.elements).toHaveLength(0);

      UnitOfWork.execute(d1, uow => layer1.setElements([e1], uow));
      expect(layer1.elements).toHaveLength(1);

      UnitOfWork.executeWithUndo(d1, 'Add', uow => layer1.setElements([e1, e2], uow));
      expect(layer1.elements).toHaveLength(2);

      d1.undoManager.undo();
      expect(layer1.elements).toHaveLength(1);

      d1.undoManager.redo();
      expect(layer1.elements).toHaveLength(2);

      UnitOfWork.executeWithUndo(d1, 'Add', uow => layer1.setElements([e2], uow));
      expect(layer1.elements).toHaveLength(1);

      d1.undoManager.undo();
      expect(layer1.elements).toHaveLength(2);

      d1.undoManager.redo();
      expect(layer1.elements).toHaveLength(1);
    });
  });

  describe('addElement', () => {
    it('should add element', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      UnitOfWork.execute(d1, uow => d1.layers.add(layer1, uow));

      UnitOfWork.executeWithUndo(d1, 'Add', uow =>
        layer1.addElement(ElementFactory.emptyNode('id1', layer1), uow)
      );

      expect(layer1.elements.length).toEqual(1);

      if (doc2) {
        const layerDoc2 = doc2.diagrams[0]!.layers.all[0];
        expect(layerDoc2).toBeInstanceOf(RegularLayer);
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
      }

      d1.undoManager.undo();
      expect(layer1.elements.length).toEqual(0);

      d1.undoManager.redo();
      expect(layer1.elements.length).toEqual(1);
    });

    it('should remove element', () => {
      const { diagram1, layer1, layer2 } = standardTestModel(backend);

      const e1 = ElementFactory.emptyNode('id1', layer1);
      const e2 = ElementFactory.emptyNode('id2', layer1);
      UnitOfWork.execute(diagram1, uow => {
        layer1.addElement(e1, uow);
        layer1.addElement(e2, uow);
      });

      expect(layer1.elements.length).toEqual(2);
      if (layer2) expect(layer2.elements.length).toEqual(2);

      UnitOfWork.executeWithUndo(diagram1, 'Remove', uow => layer1.removeElement(e1, uow));

      expect(layer1.elements.length).toEqual(1);
      if (layer2) expect(layer2.elements.length).toEqual(1);

      diagram1.undoManager.undo();

      expect(layer1.elements.length).toEqual(2);
      if (layer2) expect(layer2.elements.length).toEqual(2);

      diagram1.undoManager.redo();

      expect(layer1.elements.length).toEqual(1);
      if (layer2) expect(layer2.elements.length).toEqual(1);
    });

    it('should add, remove and re-add', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const elementAdd1 = vi.fn();
      d1.on('elementAdd', elementAdd1);

      const elementAdd2 = vi.fn();
      if (doc2) doc2.diagrams[0]!.on('elementAdd', elementAdd2);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      UnitOfWork.execute(d1, uow => d1.layers.add(layer1, uow));

      const layerDoc2 = doc2 ? doc2.diagrams[0]!.layers.all[0] : undefined;

      const element = ElementFactory.emptyNode('id1', layer1);
      UnitOfWork.execute(d1, uow => layer1.addElement(element, uow));
      expect(layer1.elements.length).toEqual(1);
      expect(elementAdd1).toBeCalledTimes(1);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
        expect(elementAdd2).toBeCalledTimes(1);
      }

      UnitOfWork.execute(d1, uow => layer1.removeElement(element, uow));
      expect(layer1.elements.length).toEqual(0);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(0);
      }

      UnitOfWork.execute(d1, uow => layer1.addElement(element, uow));
      expect(layer1.elements.length).toEqual(1);
      expect(elementAdd1).toBeCalledTimes(2);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
        expect(elementAdd2).toBeCalledTimes(2);
      }
    });
  });

  describe('removeElement', () => {
    it('should remove element', () => {
      const { diagram1, layer1, layer2 } = standardTestModel(backend);

      const e1 = ElementFactory.emptyNode('id1', layer1);
      UnitOfWork.execute(diagram1, uow => layer1.addElement(e1, uow));

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Remove element', uow => layer1.removeElement(e1, uow));

      // Verify
      expect(layer1.elements.length).toEqual(0);
      if (layer2) expect(layer2.elements.length).toEqual(0);

      // Act & Verify
      diagram1.undoManager.undo();
      expect(layer1.elements.length).toEqual(1);
      if (layer2) expect(layer2.elements.length).toEqual(1);

      // Act & Verify
      diagram1.undoManager.redo();
      expect(layer1.elements.length).toEqual(0);
      if (layer2) expect(layer2.elements.length).toEqual(0);
    });

    it('should remove group', () => {
      const { diagram1, diagram2, layer1, layer2 } = standardTestModel(backend);

      const g = ElementFactory.emptyNode('group', layer1);
      UnitOfWork.execute(diagram1, uow => {
        g.changeNodeType('group', uow);
        layer1.addElement(g, uow);
      });

      const m1 = ElementFactory.emptyNode('m1', layer1);
      const m2 = ElementFactory.emptyNode('m2', layer1);
      UnitOfWork.execute(diagram1, uow => {
        g.addChild(m1, uow);
        g.addChild(m2, uow);
      });

      const g2 = diagram2 ? diagram2.lookup(g.id) : undefined;

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Remove group', uow => layer1.removeElement(g, uow));

      // Verify
      expect(layer1.elements.length).toEqual(0);
      if (layer2) expect(layer2.elements.length).toEqual(0);

      // Act & Verify
      diagram1.undoManager.undo();

      expect(diagram1.lookup(g.id)!.children.length).toEqual(2);
      expect(layer1.elements.length).toEqual(1);
      if (layer2) {
        expect(g2!.children.length).toEqual(2);
        expect(layer2.elements.length).toEqual(1);
      }

      // Act & Verify
      diagram1.undoManager.redo();
      expect(layer1.elements.length).toEqual(0);
      if (layer2) expect(layer2.elements.length).toEqual(0);
    });
  });

  describe('stackModify', () => {
    it('should move elements forward', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const n1 = ElementFactory.emptyNode('n1', layer1);
      const n2 = ElementFactory.emptyNode('n2', layer1);
      const n3 = ElementFactory.emptyNode('n3', layer1);
      UnitOfWork.execute(diagram1, uow => {
        layer1.addElement(n1, uow);
        layer1.addElement(n2, uow);
        layer1.addElement(n3, uow);
      });

      UnitOfWork.executeWithUndo(diagram1, 'Restack', uow => {
        layer1.stackModify([n1], 1, uow);
      });

      expect(layer1.elements.map(e => e.id)).toEqual(['n2', 'n1', 'n3']);

      diagram1.undoManager.undo();
      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n2', 'n3']);

      diagram1.undoManager.redo();
      expect(layer1.elements.map(e => e.id)).toEqual(['n2', 'n1', 'n3']);
    });

    it('should move elements backward', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const n1 = ElementFactory.emptyNode('n1', layer1);
      const n2 = ElementFactory.emptyNode('n2', layer1);
      const n3 = ElementFactory.emptyNode('n3', layer1);
      UnitOfWork.execute(diagram1, uow => {
        layer1.addElement(n1, uow);
        layer1.addElement(n2, uow);
        layer1.addElement(n3, uow);
      });

      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n2', 'n3']);

      UnitOfWork.executeWithUndo(diagram1, 'Restack', uow => {
        layer1.stackModify([n3], -1, uow);
      });

      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n3', 'n2']);

      diagram1.undoManager.undo();
      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n2', 'n3']);

      diagram1.undoManager.redo();
      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n3', 'n2']);
    });

    it('should move multiple elements together', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const n1 = ElementFactory.emptyNode('n1', layer1);
      const n2 = ElementFactory.emptyNode('n2', layer1);
      const n3 = ElementFactory.emptyNode('n3', layer1);
      const n4 = ElementFactory.emptyNode('n4', layer1);
      UnitOfWork.execute(diagram1, uow => {
        layer1.addElement(n1, uow);
        layer1.addElement(n2, uow);
        layer1.addElement(n3, uow);
        layer1.addElement(n4, uow);
      });

      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n2', 'n3', 'n4']);

      UnitOfWork.executeWithUndo(diagram1, 'Restack', uow => {
        layer1.stackModify([n1, n2], 1, uow);
      });

      expect(layer1.elements.map(e => e.id)).toEqual(['n1', 'n3', 'n2', 'n4']);
    });
  });
});
