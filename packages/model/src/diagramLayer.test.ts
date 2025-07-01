/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { Layer } from './diagramLayer';
import { TestDiagramBuilder, TestModel } from './test-support/builder';

describe('LayerManager', () => {
  describe('visible', () => {
    let diagram: TestDiagramBuilder;
    let layer1: Layer;
    let layer2: Layer;

    beforeEach(() => {
      diagram = TestModel.newDiagram();

      layer1 = diagram.newLayer('layer1');
      layer2 = diagram.newLayer('layer2');
    });

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
});
