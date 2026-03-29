import { describe, expect, it } from 'vitest';
import { createThumbnailFromStencil } from './diagramThumbnail';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('createThumbnailFromStencil', () => {
  it('preserves negative bounds offsets in the viewBox', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer({
      nodes: [{ bounds: { x: -50, y: 0, w: 120, h: 70, r: 0 } }]
    });

    const node = layer.elements[0]!;

    createThumbnailFromStencil(
      {
        bounds: node.bounds,
        elements: [node],
        diagram,
        layer
      },
      { padding: 5 }
    );

    expect(diagram.viewBox.offset).toEqual({ x: -55, y: -5 });
    expect(diagram.viewBox.dimensions).toEqual({ w: 130, h: 80 });
    expect(diagram.viewBox.svgViewboxString).toBe('-55 -5 130 80');
  });
});
