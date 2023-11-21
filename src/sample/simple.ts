import { SerializedDiagram } from '../model-viewer/serialization.ts';

export const simpleDiagram: SerializedDiagram = {
  elements: [
    {
      type: 'edge',
      id: 'e1',
      start: { anchor: 'c', node: { id: '3' } },
      end: { anchor: 'c', node: { id: '4' } }
    },
    {
      type: 'edge',
      id: 'e2',
      start: { position: { x: 20, y: 20 } },
      end: { position: { x: 100, y: 100 } }
    },
    {
      type: 'node',
      nodeType: 'star',
      id: '2',
      bounds: {
        pos: { x: 400, y: 270 },
        size: { w: 150, h: 150 },
        rotation: 0
      },
      children: []
    },

    {
      type: 'node',
      nodeType: 'rect',
      id: '3',
      bounds: {
        pos: { x: 370, y: 20 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      children: []
    },

    {
      type: 'node',
      nodeType: 'rect',
      id: '4',
      bounds: {
        pos: { x: 370, y: 185 },
        size: { w: 50, h: 20 },
        rotation: 0
      },
      children: []
    }
  ]
};
