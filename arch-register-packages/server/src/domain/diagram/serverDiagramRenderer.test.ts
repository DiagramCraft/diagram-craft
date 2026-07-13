import { describe, expect, it } from 'vitest';
import { hash64 } from '@diagram-craft/utils/hash';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { generateAccurateSvgPreview } from './serverDiagramRenderer';

const IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const makeImageDoc = (): SerializedDiagramDocument => {
  const imageBytes = Buffer.from(IMAGE_BASE64, 'base64');
  const imageHash = hash64(imageBytes);

  return {
    diagrams: [
      {
        id: 'd1',
        name: 'Diagram 1',
        layers: [
          {
            id: 'l1',
            name: 'Layer 1',
            type: 'layer',
            layerType: 'regular',
            elements: [
              {
                type: 'node',
                nodeType: 'rect',
                id: 'n1',
                bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
                props: {
                  fill: {
                    enabled: true,
                    type: 'image',
                    image: { id: imageHash, fit: 'cover' }
                  }
                },
                texts: { text: '' },
                metadata: {}
              }
            ]
          }
        ],
        diagrams: [],
        canvas: { x: 0, y: 0, w: 100, h: 100 }
      }
    ],
    attachments: { [imageHash]: IMAGE_BASE64 },
    customPalette: [],
    styles: { edgeStyles: [], nodeStyles: [], textStyles: [] },
    schemas: []
  };
};

describe('generateAccurateSvgPreview', () => {
  it('includes the diagram canvas background', async () => {
    const svg = await generateAccurateSvgPreview(makeImageDoc());

    expect(svg).not.toBeNull();
    expect(svg).toContain('class="svg-doc-bounds"');
    expect(svg).toContain('style="fill: var(--canvas-bg2);"');
    expect(svg!.indexOf('class="svg-doc-bounds"')).toBeLessThan(svg!.indexOf('id="node-n1"'));
  });

  it('inlines embedded images instead of returning process-local blob URLs', async () => {
    const svg = await generateAccurateSvgPreview(makeImageDoc());

    expect(svg).not.toBeNull();
    expect(svg).toContain(`href="data:application/octet-stream;base64,${IMAGE_BASE64}"`);
    expect(svg).not.toContain('blob:nodedata:');
  });
});
