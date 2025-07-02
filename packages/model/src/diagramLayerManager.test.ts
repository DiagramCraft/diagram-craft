/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { RegularLayer } from './diagramLayerRegular';
import { TestDiagramBuilder, TestLayerBuilder, TestModel } from './test-support/builder';
import { UnitOfWork } from './unitOfWork';

describe('LayerManager', () => {
  let diagram: TestDiagramBuilder;
  let layer1: RegularLayer;
  let layer2: RegularLayer;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer1 = diagram.newLayer('layer1');
    layer2 = diagram.newLayer('layer2');
  });

  describe('all', () => {
    it('should return all layers in the correct order', () => {
      const allLayers = diagram.layers.all;
      expect(allLayers).toEqual([layer1, layer2]);
    });

    it('should update the list of layers when a new layer is added', () => {
      const newLayer = diagram.newLayer('layer3');
      const allLayers = diagram.layers.all;
      expect(allLayers).toEqual([layer1, layer2, newLayer]);
    });

    it('should update the list of layers when a layer is removed', () => {
      diagram.layers.remove(layer1, UnitOfWork.immediate(diagram));
      const allLayers = diagram.layers.all;
      expect(allLayers).toEqual([layer2]);
    });
  });

  describe('byId', () => {
    it('should return the correct layer by its ID', () => {
      const retrievedLayer = diagram.layers.byId(layer1.id);
      expect(retrievedLayer).toBe(layer1);
    });

    it('should return undefined if no layer matches the provided ID', () => {
      const nonExistentLayer = diagram.layers.byId('non-existent-id');
      expect(nonExistentLayer).toBeUndefined();
    });
  });

  describe('visible', () => {
    it('should return all layers initially as visible', () => {
      const visibleLayers = diagram.layers.visible;
      expect(visibleLayers).toEqual([layer1, layer2]);
    });

    it('should return only visible layers after toggling visibility', () => {
      diagram.layers.toggleVisibility(layer1 as any);
      const visibleLayers = diagram.layers.visible;
      expect(visibleLayers).toEqual([layer2]);
    });

    it('should include a layer back to visible when toggled again', () => {
      diagram.layers.toggleVisibility(layer1 as any);
      diagram.layers.toggleVisibility(layer1 as any);
      const visibleLayers = diagram.layers.visible;
      expect(visibleLayers).toEqual([layer1, layer2]);
    });
  });

  describe('add', () => {
    it('should add a new layer to the list of all layers', () => {
      const newLayer = new RegularLayer('newLayer', 'newLayer', [], diagram);
      const uow = UnitOfWork.immediate(diagram);

      diagram.layers.add(newLayer, uow);

      const allLayers = diagram.layers.all;
      expect(allLayers).toContain(newLayer);
    });

    it('should mark the newly added layer as visible', () => {
      const newLayer = new TestLayerBuilder('newLayer', diagram);
      const uow = UnitOfWork.immediate(diagram);

      diagram.layers.add(newLayer, uow);

      const visibleLayers = diagram.layers.visible;
      expect(visibleLayers).toContain(newLayer);
    });

    it('should set the added layer as the active layer', () => {
      const newLayer = new TestLayerBuilder('newLayer', diagram);
      const uow = UnitOfWork.immediate(diagram);

      diagram.layers.add(newLayer, uow);

      const activeLayer = diagram.layers.active;
      expect(activeLayer).toBe(newLayer);
    });
  });

  describe('remove', () => {
    it('should remove a layer from the list of all layers', () => {
      const uow = UnitOfWork.immediate(diagram);

      diagram.layers.remove(layer1, uow);

      const allLayers = diagram.layers.all;
      expect(allLayers).not.toContain(layer1);
    });

    it('should remove a layer from the list of visible layers', () => {
      const uow = UnitOfWork.immediate(diagram);

      diagram.layers.remove(layer1, uow);

      const visibleLayers = diagram.layers.visible;
      expect(visibleLayers).not.toContain(layer1);
    });
  });
});
