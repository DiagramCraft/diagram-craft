import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/types';

export const simpleDiagram: SerializedDiagramDocument = {
  diagrams: [
    {
      id: 'doc1',
      name: 'Sheet 1',
      layers: [
        {
          id: 'layer1',
          name: 'Layer 1',
          type: 'layer',
          layerType: 'basic',
          elements: [
            {
              id: 'e1',
              type: 'edge',
              start: {
                anchor: 0,
                node: {
                  id: '3'
                },
                position: {
                  x: 350,
                  y: 70
                }
              },
              end: {
                anchor: 0,
                node: {
                  id: '4'
                },
                position: {
                  x: 325,
                  y: 255
                }
              },
              labelNodes: [
                {
                  id: 't2',
                  type: 'perpendicular-readable',
                  offset: {
                    x: 0,
                    y: 0
                  },
                  timeOffset: 0.843974175035868
                }
              ],
              waypoints: [],
              props: {
                style: 'default-edge',
                arrow: {
                  start: {
                    type: 'SQUARE_ARROW_OUTLINE'
                  },
                  end: {
                    type: 'CROWS_FEET_BAR'
                  }
                }
              }
            },
            {
              id: 'e2',
              type: 'edge',
              start: {
                position: {
                  x: 20,
                  y: 20
                }
              },
              end: {
                position: {
                  x: 300,
                  y: 400
                }
              },
              labelNodes: [],
              waypoints: [],
              props: {
                style: 'default-edge',
                highlight: []
              }
            },
            {
              id: '3',
              type: 'node',
              nodeType: 'rounded-rect',
              bounds: {
                x: 300,
                y: 20,
                w: 100,
                h: 100,
                r: 0
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.5,
                    y: 0
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.99,
                    y: 0.01
                  },
                  clip: false
                },
                {
                  point: {
                    x: 1,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.99,
                    y: 0.99
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.5,
                    y: 1
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.01,
                    y: 0.99
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.01,
                    y: 0.01
                  },
                  clip: false
                }
              ],
              children: [],
              props: {
                style: 'default',
                text: {
                  text: ''
                }
              }
            },
            {
              id: '4',
              type: 'node',
              nodeType: 'rect',
              bounds: {
                x: 300,
                y: 245,
                w: 50,
                h: 20,
                r: 0
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.5,
                    y: 0
                  },
                  clip: false
                },
                {
                  point: {
                    x: 1,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.5,
                    y: 1
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0,
                    y: 0.5
                  },
                  clip: false
                }
              ],
              children: [],
              props: {
                style: 'default'
              }
            },
            {
              id: 't2',
              type: 'node',
              nodeType: 'text',
              bounds: {
                x: 296.9006456241033,
                y: 220.13522238163557,
                w: 64,
                h: 12,
                r: 0.13432144195296836
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.51,
                    y: 0
                  },
                  clip: false
                },
                {
                  point: {
                    x: 1,
                    y: 0.86
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.49,
                    y: 1
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0,
                    y: 0.14
                  },
                  clip: false
                }
              ],
              children: [],
              props: {
                style: 'default-text',
                labelForEdgeId: 'e1',
                text: {
                  text: 'Hello world',
                  align: 'center'
                },
                fill: {
                  enabled: true,
                  color: '#ffffff'
                }
              }
            },
            {
              id: 'epb7kko',
              type: 'node',
              nodeType: 'table',
              bounds: {
                x: 90,
                y: 390,
                w: 200,
                h: 200,
                r: 0
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.5,
                    y: 1
                  },
                  clip: false
                },
                {
                  point: {
                    x: 1,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.5,
                    y: 0
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0,
                    y: 0.5
                  },
                  clip: false
                }
              ],
              children: [
                {
                  id: 'el4hq06',
                  type: 'node',
                  nodeType: 'tableRow',
                  bounds: {
                    x: 90,
                    w: 200,
                    y: 390,
                    h: 100,
                    r: 0
                  },
                  anchors: [
                    {
                      point: {
                        x: 0.5,
                        y: 0.5
                      },
                      clip: true
                    },
                    {
                      point: {
                        x: 0.5,
                        y: 1
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 1,
                        y: 0.5
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.5,
                        y: 0
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0,
                        y: 0.5
                      },
                      clip: false
                    }
                  ],
                  children: [
                    {
                      id: 'cukdoml',
                      type: 'node',
                      nodeType: 'text',
                      bounds: {
                        x: 90,
                        w: 100,
                        y: 390,
                        h: 100,
                        r: 0
                      },
                      anchors: [
                        {
                          point: {
                            x: 0.5,
                            y: 0.5
                          },
                          clip: true
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 0
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 1,
                            y: 0.5
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 1
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0,
                            y: 0.5
                          },
                          clip: false
                        }
                      ],
                      children: [],
                      props: {
                        style: 'default',
                        highlight: [],
                        text: {
                          text: 'Lorem ipsum'
                        },
                        stroke: {
                          enabled: false
                        },
                        fill: {
                          enabled: true
                        }
                      }
                    },
                    {
                      id: '3p0ktgd',
                      type: 'node',
                      nodeType: 'text',
                      bounds: {
                        x: 190,
                        w: 100,
                        y: 390,
                        h: 100,
                        r: 0
                      },
                      anchors: [
                        {
                          point: {
                            x: 0.5,
                            y: 0.5
                          },
                          clip: true
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 0
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 1,
                            y: 0.5
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 1
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0,
                            y: 0.5
                          },
                          clip: false
                        }
                      ],
                      children: [],
                      props: {
                        style: 'default',
                        text: {
                          text: 'Dolor sit amet'
                        },
                        stroke: {
                          enabled: false
                        },
                        fill: {
                          enabled: true,
                          color: '#f7edfe'
                        }
                      }
                    }
                  ],
                  props: {
                    style: 'default',
                    shapeContainer: {
                      canResize: 'both',
                      containerResize: 'both',
                      layout: 'horizontal',
                      childResize: 'fill',
                      gapType: 'around',
                      gap: 0
                    },
                    highlight: []
                  }
                },
                {
                  id: 'ekk5sda',
                  type: 'node',
                  nodeType: 'tableRow',
                  bounds: {
                    x: 90,
                    w: 200,
                    y: 490,
                    h: 100,
                    r: 0
                  },
                  anchors: [
                    {
                      point: {
                        x: 0.5,
                        y: 0.5
                      },
                      clip: true
                    },
                    {
                      point: {
                        x: 0.5,
                        y: 1
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 1,
                        y: 0.5
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.5,
                        y: 0
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0,
                        y: 0.5
                      },
                      clip: false
                    }
                  ],
                  children: [
                    {
                      id: 'nq982mr',
                      type: 'node',
                      nodeType: 'text',
                      bounds: {
                        x: 90,
                        w: 100,
                        y: 490,
                        h: 100,
                        r: 0
                      },
                      anchors: [
                        {
                          point: {
                            x: 0.5,
                            y: 0.5
                          },
                          clip: true
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 0
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 1,
                            y: 0.5
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 1
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0,
                            y: 0.5
                          },
                          clip: false
                        }
                      ],
                      children: [],
                      props: {
                        style: 'default',
                        text: {
                          text: 'Consectetur adipiscing elit'
                        },
                        stroke: {
                          enabled: false
                        },
                        fill: {
                          enabled: true,
                          color: '#d2deff'
                        }
                      }
                    },
                    {
                      id: 'rpvl4ar',
                      type: 'node',
                      nodeType: 'text',
                      bounds: {
                        x: 190,
                        w: 100,
                        y: 490,
                        h: 100,
                        r: 0
                      },
                      anchors: [
                        {
                          point: {
                            x: 0.5,
                            y: 0.5
                          },
                          clip: true
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 0
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 1,
                            y: 0.5
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0.5,
                            y: 1
                          },
                          clip: false
                        },
                        {
                          point: {
                            x: 0,
                            y: 0.5
                          },
                          clip: false
                        }
                      ],
                      children: [],
                      props: {
                        style: 'default',
                        text: {
                          text: '12345'
                        },
                        stroke: {
                          enabled: false
                        },
                        fill: {
                          enabled: true,
                          color: '#e9f6e9'
                        }
                      }
                    }
                  ],
                  props: {
                    style: 'default',
                    shapeContainer: {
                      canResize: 'both',
                      containerResize: 'both',
                      layout: 'horizontal',
                      childResize: 'fill',
                      gapType: 'around',
                      gap: 0
                    },
                    highlight: []
                  }
                }
              ],
              props: {
                style: 'default',
                shapeContainer: {
                  canResize: 'both',
                  containerResize: 'both',
                  layout: 'vertical',
                  childResize: 'scale',
                  gapType: 'around',
                  gap: 10
                },
                highlight: [],
                shapeTable: {
                  gap: 0
                }
              }
            }
          ]
        }
      ],
      diagrams: [
        {
          id: 'doc1.1',
          name: 'Sheet 1.1',
          layers: [
            {
              id: 'layer1',
              name: 'Layer 1',
              type: 'layer',
              layerType: 'basic',
              elements: [
                {
                  id: '2',
                  type: 'node',
                  nodeType: 'star',
                  bounds: {
                    x: 400,
                    y: 270,
                    w: 150,
                    h: 150,
                    r: 0
                  },
                  anchors: [
                    {
                      point: {
                        x: 0.5,
                        y: 0.5
                      },
                      clip: true
                    },
                    {
                      point: {
                        x: 0.57,
                        y: 0.15
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.81,
                        y: 0.32
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.86,
                        y: 0.46
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.77,
                        y: 0.74
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.65,
                        y: 0.83
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.35,
                        y: 0.83
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.23,
                        y: 0.74
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.14,
                        y: 0.46
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.19,
                        y: 0.32
                      },
                      clip: false
                    },
                    {
                      point: {
                        x: 0.43,
                        y: 0.15
                      },
                      clip: false
                    }
                  ],
                  children: [],
                  props: {
                    style: 'default'
                  }
                }
              ]
            }
          ],
          diagrams: [],
          canvas: {
            x: 0,
            y: 0,
            w: 640,
            h: 640
          }
        }
      ],
      canvas: {
        w: 1200,
        h: 640,
        x: 0,
        y: 0
      }
    },
    {
      id: 'doc2',
      name: 'Sheet 2',
      layers: [
        {
          id: 'layer1',
          name: 'Layer 1',
          type: 'layer',
          layerType: 'basic',
          elements: [
            {
              id: '2',
              type: 'node',
              nodeType: 'star',
              bounds: {
                x: 400,
                y: 270,
                w: 150,
                h: 150,
                r: 0
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.57,
                    y: 0.15
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.81,
                    y: 0.32
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.86,
                    y: 0.46
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.77,
                    y: 0.74
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.65,
                    y: 0.83
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.35,
                    y: 0.83
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.23,
                    y: 0.74
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.14,
                    y: 0.46
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.19,
                    y: 0.32
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.43,
                    y: 0.15
                  },
                  clip: false
                }
              ],
              children: [],
              props: {
                style: 'default'
              }
            }
          ]
        },
        {
          id: 'layer2',
          name: 'Layer 2',
          type: 'layer',
          layerType: 'basic',
          elements: [
            {
              id: '3',
              type: 'node',
              nodeType: 'rounded-rect',
              bounds: {
                x: 370,
                y: 20,
                w: 100,
                h: 100,
                r: 0
              },
              anchors: [
                {
                  point: {
                    x: 0.5,
                    y: 0.5
                  },
                  clip: true
                },
                {
                  point: {
                    x: 0.5,
                    y: 0
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.99,
                    y: 0.01
                  },
                  clip: false
                },
                {
                  point: {
                    x: 1,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.99,
                    y: 0.99
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.5,
                    y: 1
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.01,
                    y: 0.99
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0,
                    y: 0.5
                  },
                  clip: false
                },
                {
                  point: {
                    x: 0.01,
                    y: 0.01
                  },
                  clip: false
                }
              ],
              children: [],
              props: {
                style: 'default',
                text: {
                  text: ''
                }
              }
            }
          ]
        }
      ],
      diagrams: [],
      canvas: {
        x: 0,
        y: 0,
        w: 640,
        h: 640
      }
    }
  ],
  attachments: {}
};
