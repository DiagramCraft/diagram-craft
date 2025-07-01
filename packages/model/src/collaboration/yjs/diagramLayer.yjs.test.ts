/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { TestModel } from '../../test-support/builder';
import { RegularLayer } from '../../diagramLayer';
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

      // For now, until layers are synced, we add them to d2 as well
      d2.layers.add(new RegularLayer('layer1', 'layer1', [], d2), UnitOfWork.immediate(d2));
      d2.layers.add(new RegularLayer('layer2', 'layer2', [], d2), UnitOfWork.immediate(d2));

      d1.layers.toggleVisibility(layer1);
      expect(d1.layers.visible).toEqual([layer2]);

      expect(d2.layers.visible.map(d => d.id)).toEqual(['layer2']);
    });
  });
});
