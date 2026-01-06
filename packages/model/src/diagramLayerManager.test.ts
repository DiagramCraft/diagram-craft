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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

      const allLayers = diagram1.layers.all;
      expect(allLayers).toEqual([layer1, layer2]);
    });

    it('should update the list of layers when a new layer is added', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'layer2', [], diagram1);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

      // Act
      const newLayer = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

      // Verify
      const allLayers = diagram1.layers.all;
      expect(allLayers).toEqual([layer1, layer2, newLayer]);
    });

    it('should update the list of layers when a layer is removed', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('newLayer', 'newLayer', [], diagram1);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

      // Act
      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer1, uow));

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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).toEqual([layer1, layer2]);
    });

    it('should return only visible layers after toggling visibility', () => {
      // Setup
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'layer2', [], diagram1);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

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

      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).toContain(newLayer);
    });

    it('should set the added layer as the active layer', () => {
      // Setup
      const { diagram1 } = standardTestModel(backend);

      const newLayer = new TestLayerBuilder('newLayer', diagram1);

      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

      const activeLayer = diagram1.layers.active;
      expect(activeLayer).toBe(newLayer);
    });
  });

  describe('remove', () => {
    it('should remove a layer from the list of all layers', () => {
      // Setup
      const { diagram1, diagram2, layer1 } = standardTestModel(backend);

      // Act
      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer1, uow));

      // Verify
      expect(diagram1.layers.all).not.toContain(layer1);
      if (diagram2) {
        expect(diagram2.layers.all.map(l => l.id)).not.toContain(layer1.id);
      }
    });

    it('should remove a layer from the list of visible layers', () => {
      // Setup
      const { diagram1, layer1 } = standardTestModel(backend);

      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer1, uow));

      const visibleLayers = diagram1.layers.visible;
      expect(visibleLayers).not.toContain(layer1);
    });
  });

  describe('move', () => {
    it('should move a layer below another layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
      });

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer1.id, layer2.id, layer3.id]);

      UnitOfWork.execute(diagram1, uow =>
        diagram1.layers.move([layer3], uow, { layer: layer1, relation: 'below' })
      );

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer3.id, layer1.id, layer2.id]);
    });

    it('should move a layer above another layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
      });

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer1.id, layer2.id, layer3.id]);

      UnitOfWork.execute(diagram1, uow =>
        diagram1.layers.move([layer1], uow, { layer: layer3, relation: 'above' })
      );

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer2.id, layer3.id, layer1.id]);
    });

    it('should move multiple layers below another layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      const layer4 = new RegularLayer('layer4', 'Layer 4', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
        diagram1.layers.add(layer4, uow);
      });

      expect(diagram1.layers.all.map(l => l.id)).toEqual([
        layer1.id,
        layer2.id,
        layer3.id,
        layer4.id
      ]);

      UnitOfWork.execute(diagram1, uow =>
        diagram1.layers.move([layer3, layer4], uow, { layer: layer1, relation: 'below' })
      );

      expect(diagram1.layers.all.map(l => l.id)).toEqual([
        layer3.id,
        layer4.id,
        layer1.id,
        layer2.id
      ]);
    });

    it('should move multiple layers above another layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      const layer4 = new RegularLayer('layer4', 'Layer 4', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
        diagram1.layers.add(layer4, uow);
      });

      expect(diagram1.layers.all.map(l => l.id)).toEqual([
        layer1.id,
        layer2.id,
        layer3.id,
        layer4.id
      ]);

      UnitOfWork.execute(diagram1, uow =>
        diagram1.layers.move([layer1, layer2], uow, { layer: layer4, relation: 'above' })
      );

      expect(diagram1.layers.all.map(l => l.id)).toEqual([
        layer3.id,
        layer4.id,
        layer1.id,
        layer2.id
      ]);
    });

    it('should undo move layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
      });

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer1.id, layer2.id, layer3.id]);

      UnitOfWork.executeWithUndo(diagram1, 'Move', uow =>
        diagram1.layers.move([layer3], uow, { layer: layer1, relation: 'below' })
      );

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer3.id, layer1.id, layer2.id]);

      diagram1.undoManager.undo();

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer1.id, layer2.id, layer3.id]);
    });

    it('should redo move layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layer2 = new RegularLayer('layer2', 'Layer 2', [], diagram1);
      const layer3 = new RegularLayer('layer3', 'Layer 3', [], diagram1);
      UnitOfWork.execute(diagram1, uow => {
        diagram1.layers.add(layer2, uow);
        diagram1.layers.add(layer3, uow);
      });

      UnitOfWork.executeWithUndo(diagram1, 'Move', uow =>
        diagram1.layers.move([layer3], uow, { layer: layer1, relation: 'below' })
      );

      diagram1.undoManager.undo();
      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer1.id, layer2.id, layer3.id]);

      diagram1.undoManager.redo();

      expect(diagram1.layers.all.map(l => l.id)).toEqual([layer3.id, layer1.id, layer2.id]);
    });
  });

  describe('undo/redo', () => {
    it('should undo add layer', () => {
      const { diagram1 } = standardTestModel(backend);
      const initialLayerCount = diagram1.layers.all.length;

      const newLayer = new RegularLayer('new-layer', 'New Layer', [], diagram1);
      UnitOfWork.executeWithUndo(diagram1, 'Add layer', uow => diagram1.layers.add(newLayer, uow));

      expect(diagram1.layers.all).toHaveLength(initialLayerCount + 1);
      expect(diagram1.layers.all).toContain(newLayer);

      diagram1.undoManager.undo();

      expect(diagram1.layers.all).toHaveLength(initialLayerCount);
      expect(diagram1.layers.all).not.toContain(newLayer);
    });

    it('should redo add layer', () => {
      const { diagram1 } = standardTestModel(backend);
      const initialLayerCount = diagram1.layers.all.length;

      const newLayer = new RegularLayer('new-layer', 'New Layer', [], diagram1);
      UnitOfWork.executeWithUndo(diagram1, 'Add layer', uow => diagram1.layers.add(newLayer, uow));

      diagram1.undoManager.undo();
      expect(diagram1.layers.all).toHaveLength(initialLayerCount);

      diagram1.undoManager.redo();

      expect(diagram1.layers.all).toHaveLength(initialLayerCount + 1);
      expect(diagram1.layers.byId('new-layer')).toBeDefined();
      expect(diagram1.layers.byId('new-layer')!.name).toBe('New Layer');
    });

    it('should undo remove layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const initialLayerCount = diagram1.layers.all.length;

      const layerId = layer1.id;
      UnitOfWork.executeWithUndo(diagram1, 'Remove layer', uow =>
        diagram1.layers.remove(layer1, uow)
      );

      expect(diagram1.layers.all).toHaveLength(initialLayerCount - 1);
      expect(diagram1.layers.all).not.toContain(layer1);

      diagram1.undoManager.undo();

      expect(diagram1.layers.all).toHaveLength(initialLayerCount);
      expect(diagram1.layers.byId(layerId)).toBeDefined();
    });

    it('should redo remove layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);
      const layerId = layer1.id;
      const initialLayerCount = diagram1.layers.all.length;

      UnitOfWork.executeWithUndo(diagram1, 'Remove layer', uow =>
        diagram1.layers.remove(layer1, uow)
      );

      diagram1.undoManager.undo();
      expect(diagram1.layers.all).toHaveLength(initialLayerCount);

      diagram1.undoManager.redo();

      expect(diagram1.layers.all).toHaveLength(initialLayerCount - 1);
      expect(diagram1.layers.byId(layerId)).toBeUndefined();
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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(newLayer, uow));

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

      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer1, uow));

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

      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer1, uow));

      expect(removedLayers).toHaveLength(1);
      expect(removedLayers[0]!.id).toBe(layer1.id);
    });

    it('should emit layerUpdated event when a layer name is changed locally', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const updatedLayers: Array<any> = [];
      diagram1.layers.on('layerUpdated', ({ layer }) => {
        updatedLayers.push(layer);
      });

      UnitOfWork.execute(diagram1, uow => layer1.setName('Updated Name', uow));

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

      UnitOfWork.execute(diagram1, uow => layer1.setName('Remote Update', uow));

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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer2, uow));

      UnitOfWork.execute(diagram1, uow => layer1.setName('Updated Layer 1', uow));

      UnitOfWork.execute(diagram1, uow => diagram1.layers.remove(layer2, uow));

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
