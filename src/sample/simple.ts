import { SerializedDiagram } from '../model/serialization.ts';

export const simpleDiagram: SerializedDiagram = {
  elements: [
    {
      type: 'node',
      nodeType: 'rect',
      id: '2',
      bounds: {
        pos: { x: 400, y: 270 },
        size: { w: 50, h: 50 },
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
