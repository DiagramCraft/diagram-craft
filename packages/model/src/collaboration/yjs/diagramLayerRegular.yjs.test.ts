import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs } from './yjsTest';
import { TestModel } from '../../test-support/builder';
import { RegularLayer } from '../../diagramLayerRegular';
import { Diagram } from '../../diagram';
import { UnitOfWork } from '../../unitOfWork';
import { DiagramNode } from '../../diagramNode';
import { Backends } from './collaborationTestUtils';

describe.for(Backends.all())('RegularLayer [%s]', ([_, root1, _root2, before, after]) => {
  beforeEach(() => before());
  afterEach(() => after());

  describe('setElements', () => {
    it('should be possible to set elements that are already added', () => {
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
      const { doc1: c1 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      //const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      layer1.addElement(new DiagramNode('id1', layer1), UnitOfWork.immediate(d1));

      expect(layer1.elements.length).toEqual(1);

      // TODO: Add expects for doc2
    });

    it('should add, remove and re-add', () => {
      const { doc1: c1 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      //const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      const element = new DiagramNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);

      layer1.removeElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(0);

      layer1.addElement(element, UnitOfWork.immediate(d1));
      expect(layer1.elements.length).toEqual(1);

      // TODO: Add expects for doc2
    });
  });
});
