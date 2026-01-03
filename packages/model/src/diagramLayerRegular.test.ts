import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestModel } from './test-support/testModel';
import { RegularLayer } from './diagramLayerRegular';
import { UnitOfWork } from './unitOfWork';
import { Diagram } from './diagram';
import { ElementFactory } from './elementFactory';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.for(Backends.all())('RegularLayer [%s]', ([_name, backend]) => {
  beforeEach(backend.beforeEach);
  afterEach(backend.afterEach);

  describe('setElements', () => {
    it('should be possible to set elements that are already added', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      UnitOfWork.execute(d1, uow => layer1.addElement(element, uow));
      expect(layer1.elements).toHaveLength(1);

      UnitOfWork.execute(d1, uow => layer1.setElements([element], uow));
      expect(layer1.elements).toHaveLength(1);

      UnitOfWork.execute(d1, uow => layer1.setElements([], uow));
      expect(layer1.elements).toHaveLength(0);

      UnitOfWork.execute(d1, uow => layer1.setElements([element], uow));
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

      UnitOfWork.execute(d1, uow =>
        layer1.addElement(ElementFactory.emptyNode('id1', layer1), uow)
      );

      expect(layer1.elements.length).toEqual(1);

      if (doc2) {
        const layerDoc2 = doc2.diagrams[0]!.layers.all[0];
        expect(layerDoc2).toBeInstanceOf(RegularLayer);
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
      }
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

  describe('restore', () => {
    it('should restore element', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      UnitOfWork.execute(d1, uow => d1.layers.add(layer1, uow));

      const layerDoc2 = doc2 ? doc2.diagrams[0]!.layers.all[0] : undefined;

      const element = ElementFactory.emptyNode('id1', layer1);
      UnitOfWork.execute(d1, uow => layer1.addElement(element, uow));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);

      const snapshot = layer1.snapshot();

      UnitOfWork.execute(d1, uow =>
        layer1.addElement(ElementFactory.emptyNode('id2', layer1), uow)
      );
      expect(layer1.elements.length).toEqual(2);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(2);

      UnitOfWork.execute(d1, uow => layer1.restore(snapshot, uow));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
    });
  });
});
