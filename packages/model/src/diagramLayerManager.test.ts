import { describe, expect, it } from 'vitest';
import { RegularLayer } from './diagramLayerRegular';
import { TestLayerBuilder } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

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

  describe('events', () => {
    it('should emit layerAdded event when a layer is added locally', () => {
      const { diagram1 } = standardTestModel(backend);

      const addedLayers: Array<any> = [];
      diagram1.layers.on('layerAdded', ({ layer }) => {
        addedLayers.push(layer);
      });

      const newLayer = new RegularLayer('new-layer', 'New Layer', [], diagram1);
      UnitOfWork.execute(diagram1, {}, uow => diagram1.layers.add(newLayer, uow));

      expect(addedLayers).toHaveLength(1);
      expect(addedLayers[0]!.id).toBe('new-layer');
      expect(addedLayers[0]!.name).toBe('New Layer');
    });

    it('should emit layerAdded event when a layer is added remotely', () => {
      const { diagram1, diagram2 } = standardTestModel(backend);
      if (!diagram2) return;

      const addedLayers: Array<any> = [];
      diagram2.layers.on('layerAdded', ({ layer }) => {
        addedLayers.push(layer);
      });

      const newLayer = new RegularLayer('remote-layer', 'Remote Layer', [], diagram1);
      diagram1.layers.add(newLayer, UnitOfWork.immediate(diagram1));

      expect(addedLayers).toHaveLength(1);
      expect(addedLayers[0]!.id).toBe('remote-layer');
      expect(addedLayers[0]!.name).toBe('Remote Layer');
    });

    it('should emit layerRemoved event when a layer is removed locally', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const removedLayers: Array<any> = [];
      diagram1.layers.on('layerRemoved', ({ layer }) => {
        removedLayers.push(layer);
      });

      UnitOfWork.execute(diagram1, {}, uow => diagram1.layers.remove(layer1, uow));

      expect(removedLayers).toHaveLength(1);
      expect(removedLayers[0]!.id).toBe(layer1.id);
    });

    it('should emit layerRemoved event when a layer is removed remotely', () => {
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);
      if (!diagram2) return;

      const removedLayers: Array<any> = [];
      diagram2.layers.on('layerRemoved', ({ layer }) => {
        removedLayers.push(layer);
      });

      diagram1.layers.remove(layer1, UnitOfWork.immediate(diagram1));

      expect(removedLayers).toHaveLength(1);
      expect(removedLayers[0]!.id).toBe(layer1.id);
    });

    it('should emit layerUpdated event when a layer name is changed locally', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const updatedLayers: Array<any> = [];
      diagram1.layers.on('layerUpdated', ({ layer }) => {
        updatedLayers.push(layer);
      });

      UnitOfWork.execute(diagram1, {}, uow => layer1.setName('Updated Name', uow));

      expect(updatedLayers).toHaveLength(1);
      expect(updatedLayers[0]!.id).toBe(layer1.id);
      expect(updatedLayers[0]!.name).toBe('Updated Name');
    });

    it('should emit layerUpdated event when a layer name is changed remotely', () => {
      const { diagram1, diagram2, layer1, layer2 } = standardTestModel(backend);
      if (!diagram2 || !layer2) return;

      const updatedLayers: Array<any> = [];
      diagram2.layers.on('layerUpdated', ({ layer }) => {
        updatedLayers.push(layer);
      });

      layer1.setName('Remote Update', UnitOfWork.immediate(diagram1));

      expect(updatedLayers).toHaveLength(1);
      expect(updatedLayers[0]!.id).toBe(layer1.id);
      expect(updatedLayers[0]!.name).toBe('Remote Update');
    });

    it('should emit multiple events when multiple changes occur', () => {
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);
      if (!diagram2) return;

      const events: Array<{ type: string; id: string | undefined }> = [];
      diagram2.layers.on('layerAdded', ({ layer }) => {
        // Capture the id immediately while the CRDT is still populated
        events.push({ type: 'added', id: layer.id });
      });
      diagram2.layers.on('layerUpdated', ({ layer }) => {
        events.push({ type: 'updated', id: layer.id });
      });
      diagram2.layers.on('layerRemoved', ({ layer }) => {
        events.push({ type: 'removed', id: layer.id });
      });

      const layer2 = new RegularLayer('layer-2', 'Layer 2', [], diagram1);
      diagram1.layers.add(layer2, UnitOfWork.immediate(diagram1));

      layer1.setName('Updated Layer 1', UnitOfWork.immediate(diagram1));

      diagram1.layers.remove(layer2, UnitOfWork.immediate(diagram1));

      expect(events).toHaveLength(3);
      expect(events).toEqual([
        { type: 'added', id: 'layer-2' },
        { type: 'updated', id: layer1.id },
        { type: 'removed', id: undefined } // id may be undefined for removed layers
      ]);
    });

    it('should emit layerStructureChange when visibility is toggled locally', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      let eventCount = 0;
      diagram1.layers.on('layerStructureChange', () => {
        eventCount++;
      });

      diagram1.layers.toggleVisibility(layer1);

      expect(eventCount).toBe(1);
    });

    it('should emit layerStructureChange when visibility is toggled remotely', () => {
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);
      if (!diagram2) return;

      let eventCount = 0;
      diagram2.layers.on('layerStructureChange', () => {
        eventCount++;
      });

      diagram1.layers.toggleVisibility(layer1);

      expect(eventCount).toBe(1);
    });
  });
});
