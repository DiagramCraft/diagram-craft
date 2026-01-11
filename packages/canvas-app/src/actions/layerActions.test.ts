import { beforeEach, describe, expect, test } from 'vitest';
import { LayerSelectionMoveNewAction } from './layerActions';
import {
  TestDiagramBuilder,
  TestLayerBuilder,
  TestModel
} from '@diagram-craft/model/test-support/testModel';
import type { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';

const mockContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('LayerSelectionMoveNewAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  describe('undo/redo', () => {
    test('should create new layer, move elements, and support undo/redo', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });
      const node1Id = node1.id;
      const node2Id = node2.id;
      const originalLayerId = node1.layer.id;

      diagram.selection.setElements([node1, node2]);

      const initialLayerCount = diagram.layers.all.length;

      // TODO: Ideally, the undo/redo system should update the original object references
      //       so we don't need to fetch fresh references from the lookup. Currently, after
      //       undo/redo operations, object references can become stale and must be refreshed.
      // Helper to get fresh node references from the diagram
      const getNode1 = () => diagram.nodeLookup.get(node1Id)!;
      const getNode2 = () => diagram.nodeLookup.get(node2Id)!;

      // Execute the action
      new LayerSelectionMoveNewAction(mockContext(diagram)).execute();

      // Verify new layer was created
      expect(diagram.layers.all).toHaveLength(initialLayerCount + 1);

      // Find the new layer (should be named "New Layer")
      const newLayer = diagram.layers.all.find(l => l.name === 'New Layer');
      expect(newLayer).toBeDefined();

      // Verify nodes were moved to new layer
      expect(getNode1().layer.id).toBe(newLayer!.id);
      expect(getNode2().layer.id).toBe(newLayer!.id);

      // Verify selection is maintained
      expect(diagram.selection.elements.map(e => e.id)).toEqual([node1Id, node2Id]);

      // Undo
      diagram.undoManager.undo();

      // Verify layer was removed
      expect(diagram.layers.all).toHaveLength(initialLayerCount);
      expect(diagram.layers.all.map(l => l.name)).not.toContain('New Layer');

      // Verify nodes are back in original layer (using fresh references)
      expect(getNode1().layer.id).toBe(originalLayerId);
      expect(getNode2().layer.id).toBe(originalLayerId);

      // Redo
      diagram.undoManager.redo();

      // Verify layer was recreated
      expect(diagram.layers.all).toHaveLength(initialLayerCount + 1);

      // Find the recreated layer
      const recreatedLayer = diagram.layers.all.find(l => l.name === 'New Layer');
      expect(recreatedLayer).toBeDefined();

      // Verify nodes are back in the new layer (using fresh references)
      expect(getNode1().layer.id).toBe(recreatedLayer!.id);
      expect(getNode2().layer.id).toBe(recreatedLayer!.id);

      // Verify selection is maintained after redo
      expect(diagram.selection.elements.map(e => e.id)).toEqual([node1Id, node2Id]);
    });
  });
});
