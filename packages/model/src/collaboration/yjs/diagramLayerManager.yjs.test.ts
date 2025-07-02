import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { TestModel } from '../../test-support/builder';
import { RegularLayer } from '../../diagramLayerRegular';
import { Diagram } from '../../diagram';
import { UnitOfWork } from '../../unitOfWork';

describe('YJS LayerManager', () => {
  setupYJS();

  describe('visible', () => {
    it('should return only visible layers after toggling visibility', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      const layer2 = new RegularLayer('layer2', 'layer2', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));
      d1.layers.add(layer2, UnitOfWork.immediate(d1));

      expect(d1.layers.visible).toEqual([layer1, layer2]);

      const d2 = doc2.topLevelDiagrams[0]!;
      d1.layers.toggleVisibility(layer1);
      expect(d1.layers.visible).toEqual([layer2]);

      expect(d2.layers.visible.map(d => d.id)).toEqual(['layer2']);
    });
  });

  describe('add', () => {
    it('should add a new layer to the diagram', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));

      expect(d1.layers.visible).toEqual([layer1]);

      const d2 = doc2.topLevelDiagrams[0]!;
      expect(d2.layers.all.map(d => d.id)).toEqual(['layer1']);
    });
  });

  describe('remove', () => {
    it('should remove layer', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const layer1 = new RegularLayer('layer1', 'layer1', [], d1);
      const layer2 = new RegularLayer('layer2', 'layer2', [], d1);
      d1.layers.add(layer1, UnitOfWork.immediate(d1));
      d1.layers.add(layer2, UnitOfWork.immediate(d1));

      expect(d1.layers.all).toEqual([layer1, layer2]);

      const d2 = doc2.topLevelDiagrams[0]!;
      expect(d2.layers.all.map(d => d.id)).toEqual(['layer1', 'layer2']);

      d1.layers.remove(layer1, UnitOfWork.immediate(d1));
      expect(d1.layers.all).toEqual([layer2]);
      expect(d2.layers.all.map(d => d.id)).toEqual(['layer2']);
    });
  });
});
