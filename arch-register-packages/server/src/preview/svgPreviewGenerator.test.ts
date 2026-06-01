import { describe, expect, it } from 'vitest';
import { generateSvgPreview } from './svgPreviewGenerator';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';

const makeDoc = (
  elements: Array<Record<string, unknown>> = []
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
        canvas: { x: 0, y: 0, w: 1000, h: 1000, r: 0 }
      }
    ],
    customPalette: [],
    styles: { edgeStyles: [], nodeStyles: [], textStyles: [] },
    schemas: []
  }) as unknown as SerializedDiagramDocument;

describe('generateSvgPreview', () => {
  it('returns null for empty document', () => {
    const doc = { diagrams: [], customPalette: [], styles: { edgeStyles: [], nodeStyles: [], textStyles: [] }, schemas: [] } as unknown as SerializedDiagramDocument;
    expect(generateSvgPreview(doc)).toBeNull();
  });

  it('returns null for document with no elements', () => {
    expect(generateSvgPreview(makeDoc([]))).toBeNull();
  });

  it('renders a simple rect node', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 10, y: 20, w: 100, h: 50, r: 0 },
          props: {
            fill: { enabled: true, color: '#ff0000' },
            stroke: { enabled: true, color: '#000000', width: 2 }
          },
          texts: { text: 'Hello' },
          metadata: {}
        }
      ])
    );

    expect(svg).not.toBeNull();
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<path');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('Hello');
  });

  it('renders an ellipse node', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'circle',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 80, h: 80, r: 0 },
          props: {},
          texts: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('<path');
    // Circle rendered as arcs through PathListBuilder
    expect(svg).toContain(' A ');
  });

  it('renders a diamond node', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'diamond',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 60, h: 60, r: 0 },
          props: {},
          texts: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('<path');
    // Diamond rendered as lines through PathListBuilder
    expect(svg).toContain('M 30,0');
  });

  it('renders edges as lines', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 100, h: 50, r: 0 },
          props: {},
          texts: {},
          metadata: {}
        },
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n2',
          bounds: { x: 200, y: 0, w: 100, h: 50, r: 0 },
          props: {},
          texts: {},
          metadata: {}
        },
        {
          type: 'edge',
          id: 'e1',
          start: { node: { id: 'n1' }, position: { x: 100, y: 25 }, offset: { x: 0, y: 0 } },
          end: { node: { id: 'n2' }, position: { x: 200, y: 25 }, offset: { x: 0, y: 0 } },
          props: { stroke: { enabled: true, color: '#333333', width: 1 } },
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('<line');
    expect(svg).toContain('stroke="#333333"');
  });

  it('renders edges with waypoints as polylines', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'edge',
          id: 'e1',
          start: { position: { x: 0, y: 0 } },
          end: { position: { x: 100, y: 100 } },
          waypoints: [{ point: { x: 50, y: 0 } }, { point: { x: 50, y: 100 } }],
          props: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('<polyline');
  });

  it('skips hidden elements', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 100, h: 50, r: 0 },
          props: { hidden: true },
          texts: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toBeNull();
  });

  it('resolves CSS variables to concrete colors', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 100, h: 50, r: 0 },
          props: {
            fill: { enabled: true, color: 'var(--canvas-bg)' },
            stroke: { enabled: true, color: 'var(--canvas-fg)' }
          },
          texts: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#000000"');
  });

  it('applies rotation transform', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 100, h: 50, r: Math.PI / 4 },
          props: {},
          texts: {},
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('transform="rotate(');
  });

  it('truncates long text labels', () => {
    const svg = generateSvgPreview(
      makeDoc([
        {
          type: 'node',
          nodeType: 'rect',
          id: 'n1',
          bounds: { x: 0, y: 0, w: 100, h: 50, r: 0 },
          props: {},
          texts: { text: 'This is a very long text label that should be truncated' },
          metadata: {}
        }
      ])
    );

    expect(svg).toContain('...');
    expect(svg).not.toContain('truncated');
  });
});
