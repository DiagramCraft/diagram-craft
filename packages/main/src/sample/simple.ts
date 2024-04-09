import { SerializedDiagramDocument } from '@diagram-craft/model';

export const simpleDiagram: SerializedDiagramDocument = {
  diagrams: [
    {
      id: 'doc1',
      name: 'Sheet 1',
      diagrams: [
        {
          id: 'doc1.1',
          name: 'Sheet 1.1',
          diagrams: [],
          layers: [
            {
              type: 'layer',
              id: 'layer1',
              name: 'Layer 1',
              layerType: 'basic',
              elements: [
                {
                  type: 'node',
                  nodeType: 'star',
                  id: '2',
                  bounds: {
                    x: 400,
                    y: 270,
                    w: 150,
                    h: 150,
                    r: 0
                  },
                  children: [],
                  props: {}
                }
              ]
            }
          ]
        }
      ],
      layers: [
        {
          type: 'layer',
          id: 'layer1',
          name: 'Layer 1',
          layerType: 'basic',
          elements: [
            {
              type: 'edge',
              id: 'e1',
              start: { anchor: 0, node: { id: '3' } },
              end: { anchor: 0, node: { id: '4' } },
              props: {
                arrow: {
                  start: {
                    type: 'SQUARE_ARROW_OUTLINE'
                  },
                  end: {
                    type: 'CROWS_FEET_BAR'
                  }
                }
              },
              labelNodes: [
                {
                  id: 't2',
                  timeOffset: 0.5,
                  offset: { x: 0, y: 0 },
                  type: 'perpendicular-readable'
                }
              ],
              waypoints: [{ point: { x: 360, y: 200 } }]
            },
            {
              type: 'edge',
              id: 'e2',
              start: { position: { x: 20, y: 20 } },
              end: { position: { x: 300, y: 400 } },
              props: {}
            },
            {
              type: 'node',
              nodeType: 'star',
              id: '2',
              bounds: {
                x: 400,
                y: 270,
                w: 150,
                h: 150,
                r: 0
              },
              children: [],
              props: {}
            },

            {
              type: 'node',
              nodeType: 'rounded-rect',
              id: '3',
              bounds: {
                x: 370,
                y: 20,
                w: 100,
                h: 100,
                r: 0
              },
              children: [],
              props: {
                text: {
                  text: ''
                }
              }
            },

            {
              type: 'node',
              nodeType: 'rect',
              id: '4',
              bounds: {
                x: 300,
                y: 245,
                w: 50,
                h: 20,
                r: 0
              },
              children: [],
              props: {}
            },

            {
              type: 'node',
              nodeType: 'text',
              bounds: {
                x: 300,
                y: 170,
                w: 64,
                h: 17,
                r: 0
              },
              id: 't2',
              props: {
                labelForEdgeId: 'e1',
                text: {
                  text: 'Hello world',
                  align: 'center'
                },
                fill: {
                  enabled: true,
                  color: '#ffffff'
                }
              },
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'doc2',
      diagrams: [],
      name: 'Sheet 2',
      layers: [
        {
          type: 'layer',
          id: 'layer1',
          name: 'Layer 1',
          layerType: 'basic',
          elements: [
            {
              type: 'node',
              nodeType: 'star',
              id: '2',
              bounds: {
                x: 400,
                y: 270,
                w: 150,
                h: 150,
                r: 0
              },
              children: [],
              props: {}
            }
          ]
        },
        {
          type: 'layer',
          id: 'layer2',
          name: 'Layer 2',
          layerType: 'basic',
          elements: [
            {
              type: 'node',
              nodeType: 'rounded-rect',
              id: '3',
              bounds: {
                x: 370,
                y: 20,
                w: 100,
                h: 100,
                r: 0
              },
              children: [],
              props: {
                text: {
                  text: ''
                }
              }
            }
          ]
        }
      ]
    }
  ]
};
