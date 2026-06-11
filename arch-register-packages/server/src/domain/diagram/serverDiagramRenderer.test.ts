import { describe, expect, it } from 'vitest';
import { generateAccurateSvgPreview } from './serverDiagramRenderer';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';

const makeDoc = (
  elements: Array<Record<string, unknown>> = [],
  canvas = { x: 0, y: 0, w: 1000, h: 1000 },
  zoom = { x: 500, y: 500, zoom: 2 }
): SerializedDiagramDocument =>
  ({
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
            elements
          }
        ],
        diagrams: [],
        canvas,
        zoom
      }
    ],
    customPalette: [],
    styles: { edgeStyles: [], nodeStyles: [], textStyles: [] },
    schemas: []
  }) as unknown as SerializedDiagramDocument;

describe('generateAccurateSvgPreview', () => {
  it('returns null for empty document', async () => {
    const doc = {
      diagrams: [],
      customPalette: [],
      styles: { edgeStyles: [], nodeStyles: [], textStyles: [] },
      schemas: []
    } as unknown as SerializedDiagramDocument;
    expect(await generateAccurateSvgPreview(doc)).toBeNull();
  });

  it('returns null for document with no elements', async () => {
    expect(await generateAccurateSvgPreview(makeDoc([]))).toBeNull();
  });

  it('uses canvas bounds for viewBox, not viewport zoom/pan state', async () => {
    const canvas = { x: 0, y: 0, w: 1000, h: 800 };
    const zoom = { x: 500, y: 400, zoom: 2.5 }; // User zoomed in and panned

    const svg = await generateAccurateSvgPreview(
      makeDoc(
        [
          {
            type: 'node',
            nodeType: 'rect',
            id: 'n1',
            bounds: { x: 100, y: 100, w: 100, h: 50, r: 0 },
            props: {
              fill: { enabled: true, color: '#ff0000' },
              stroke: { enabled: true, color: '#000000', width: 2 }
            },
            texts: { text: 'Test' },
            metadata: {}
          }
        ],
        canvas,
        zoom
      )
    );

    expect(svg).not.toBeNull();
    expect(svg).toContain('<svg');
    
    // Should use canvas bounds (0 0 1000 800), NOT zoom state (500 400 with zoom 2.5)
    expect(svg).toContain('viewBox="0 0 1000 800"');
    
    // Should NOT contain the zoomed viewport coordinates
    expect(svg).not.toContain('viewBox="500 400');
  });

  it('renders elements correctly with canvas bounds viewBox', async () => {
    const svg = await generateAccurateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 50, y: 50, w: 100, h: 50, r: 0 },
          props: {
            fill: { enabled: true, color: '#00ff00' },
            stroke: { enabled: true, color: '#000000', width: 1 }
          },
          texts: { text: 'Node' },
          metadata: {}
        }
      ])
    );

    expect(svg).not.toBeNull();
    expect(svg).toContain('viewBox="0 0 1000 1000"');
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).toContain('Node');
  });

  it('handles custom canvas bounds correctly', async () => {
    const customCanvas = { x: -500, y: -500, w: 2000, h: 1500 };
    
    const svg = await generateAccurateSvgPreview(
      makeDoc(
        [
          {
            type: 'node',
            nodeType: 'circle',
            id: 'n1',
            bounds: { x: 0, y: 0, w: 80, h: 80, r: 0 },
            props: {},
            texts: {},
            metadata: {}
          }
        ],
        customCanvas
      )
    );

    expect(svg).not.toBeNull();
    // Should use the custom canvas bounds
    expect(svg).toContain('viewBox="-500 -500 2000 1500"');
  });
});
