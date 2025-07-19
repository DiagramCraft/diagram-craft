/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { RegularLayer } from './diagramLayerRegular';
import { TestLayerBuilder } from './test-support/builder';
import { UnitOfWork } from './unitOfWork';
import { Backends, standardTestModel } from './collaboration/yjs/collaborationTestUtils';

describe.each(Backends.all())('LayerManager [%s]', (_name, backend) => {
  describe('all', () => {
    it('should return all layers in the correct order', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      const allLayers = diagram1.layers.all;
      expect(allLayers).toEqual([layer1, layer2]);
    });

    it('should update the list of layers when a new layer is added', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'layer2', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      // Act
      const newLayer = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(newLayer, UnitOfWork.immediate(diagram1));

      // Verify
      const allLayers = diagram1.layers.all;
      expect(allLayers).toEqual([layer1, layer2, newLayer]);
    });

    it('should update the list of layers when a layer is removed', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      // Act
      diagram1.layers.remove(layer1, UnitOfWork.immediate(diagram1));

      // Verify
      expect(diagram1.layers.all).toEqual([layer2]);
    });
  });

  describe('byId', () => {
    it('should return the correct layer by its ID', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);

      // Act
      const retrievedLayer = diagram1.layers.byId(layer1.id);

      // Verify
      expect(retrievedLayer).toBe(layer1);
    });

    it('should return undefined if no layer matches the provided ID', () => {
      const { diagram1 } = standardTestModel(backend);
      const nonExistentLayer = diagram1.layers.byId('non-existent-id');
      expect(nonExistentLayer).toBeUndefined();
    });
  });

  describe('visible', () => {
    it('should return all layers initially as visible', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).toEqual([layer1, layer2]);
    });

    it('should return only visible layers after toggling visibility', () => {
      // Setup
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'layer2', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      // Act
      diagram1.layers.toggleVisibility(layer1);

      // Expect
      expect(diagram1.layers.visible).toEqual([layer2]);
      if (diagram2) {
        expect(diagram2.layers.visible.map(l => l.id)).toEqual([layer2.id]);
      }
    });

    it('should include a layer back to visible when toggled again', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      diagram1.layers.toggleVisibility(layer1 as any);
      diagram1.layers.toggleVisibility(layer1 as any);
      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).toEqual([layer1, layer2]);
    });
  });

  describe('add', () => {
    it('should add a new layer to the list of all layers', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      // Act
      const newLayer = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      diagram1.layers.add(newLayer, UnitOfWork.immediate(diagram1));

      // Verify
      expect(diagram1.layers.all).toContain(newLayer);
      if (diagram2) {
        expect(diagram2.layers.all.map(l => l.id)).toContain(newLayer.id);
      }
    });

    it('should mark the newly added layer as visible', () => {
      // Setup
      const { diagram1 } = standardTestModel(backend);

      const newLayer = new TestLayerBuilder('newLayer', diagram1);
      const uow = UnitOfWork.immediate(diagram1);

      diagram1.layers.add(newLayer, uow);

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).toContain(newLayer);
    });

    it('should set the added layer as the active layer', () => {
      // Setup
      const { diagram1 } = standardTestModel(backend);

      const newLayer = new TestLayerBuilder('newLayer', diagram1);
      const uow = UnitOfWork.immediate(diagram1);

      diagram1.layers.add(newLayer, uow);

      const activeLayer = diagram1.layers.active;
      expect(activeLayer).toBe(newLayer);
    });
  });

  describe('remove', () => {
    it('should remove a layer from the list of all layers', () => {
      // Setup
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);

      // Act
      diagram1.layers.remove(layer1, UnitOfWork.immediate(diagram1));

      // Verify
      expect(diagram1.layers.all).not.toContain(layer1);
      if (diagram2) {
        expect(diagram2.layers.all.map(l => l.id)).not.toContain(layer1.id);
      }
    });

    it('should remove a layer from the list of visible layers', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);

      const uow = UnitOfWork.immediate(diagram1);

      diagram1.layers.remove(layer1, uow);

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).not.toContain(layer1);
    });
  });
});
