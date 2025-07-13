import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestModel } from './test-support/builder';
import { RegularLayer } from './diagramLayerRegular';
import { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { Diagram } from './diagram';
import { Backends } from './collaboration/yjs/collaborationTestUtils';

describe.for(Backends.all())('RegularLayer [%s]', ([_name, backend]) => {
  beforeEach(backend.beforeEach);
  afterEach(backend.afterEach);

  describe('setElements', () => {
    it('should be possible to set elements that are already added', () => {
      const [root1] = backend.syncedDocs();

      const d1 = TestModel.newDiagramWithLayer(root1);

      const layer1 = d1.layers.all[0] as RegularLayer;

      const element = new DiagramNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements).toHaveLength(1);

      layer1.setElements([element], UnitOfWork.immediate(d1));
      expect(layer1.elements).toHaveLength(1);

      layer1.setElements([], UnitOfWork.immediate(d1));
      expect(layer1.elements).toHaveLength(0);

      layer1.setElements([element], UnitOfWork.immediate(d1));
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
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      layer1.addElement(new DiagramNode('id1', layer1), UnitOfWork.immediate(d1));

      expect(layer1.elements.length).toEqual(1);

      if (doc2) {
        const layerDoc2 = doc2.topLevelDiagrams[0].layers.all[0];
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

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      const layerDoc2 = doc2 ? doc2.topLevelDiagrams[0].layers.all[0] : undefined;

      const element = new DiagramNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
      }

      layer1.removeElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(0);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(0);
      }

      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) {
        expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
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
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      const layerDoc2 = doc2 ? doc2.topLevelDiagrams[0].layers.all[0] : undefined;

      const element = new DiagramNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);

      const snapshot = layer1.snapshot();

      layer1.addElement(new DiagramNode('id2', layer1), UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(2);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(2);

      layer1.restore(snapshot, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);
      if (doc2) expect((layerDoc2 as RegularLayer).elements.length).toEqual(1);
    });
  });
});
