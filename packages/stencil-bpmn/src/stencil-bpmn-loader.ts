import {
  addStencil,
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { BPMNActivityNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNActivity.nodeType';
import { BPMNDataObjectNodeType } from '@diagram-craft/stencil-bpmn/BPMNDataObject.nodeType';
import { BPMNDataStoreNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNDataStore.nodeType';
import { BPMNEventNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNEvent.nodeType';
import { BPMNGatewayNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNGateway.nodeType';
import { BPMNConversationNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNConversation.nodeType';
import { BPMNAnnotationNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNAnnotation.nodeType';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import { BPMNChoreographyActivityNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyActivity.nodeType';
import { BPMNChoreographyActivityParticipantNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyActivityParticipant.nodeType';
import { BPMNChoreographyEnvelopeNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyEnvelope.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import stencils from './bpmnStencils.yaml';
import { BPMNLane } from '@diagram-craft/stencil-bpmn/BPMNLane';
import { BPMNChoreographyActivityNameNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyActivityName.nodeType';
import { BPMNConversationEdgeDefinition } from '@diagram-craft/stencil-bpmn/BPMNConversationEdge.edgeType';

export const registerBPMNNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new BPMNActivityNodeDefinition());
  nodes.register(new BPMNDataStoreNodeDefinition());
  nodes.register(new BPMNDataObjectNodeType());
  nodes.register(new BPMNEventNodeDefinition());
  nodes.register(new BPMNGatewayNodeDefinition());
  nodes.register(new BPMNConversationNodeDefinition());
  nodes.register(new BPMNAnnotationNodeDefinition());
  nodes.register(new BPMNChoreographyActivityNodeDefinition());
  nodes.register(new BPMNChoreographyActivityParticipantNodeDefinition());
  nodes.register(new BPMNChoreographyActivityNameNodeDefinition());
  nodes.register(new BPMNChoreographyEnvelopeNodeDefinition());
  nodes.register(new BPMNLane());
};

export const registerBPMNEdges = async (edges: EdgeDefinitionRegistry) => {
  edges.register(new BPMNConversationEdgeDefinition());
};

export const registerBPMNStencils = async (registry: Registry) => {
  await registerBPMNNodes(registry.nodes);
  await registerBPMNEdges(registry.edges);

  const bpmnStencils: StencilPackage = {
    id: 'bpmn2',
    name: 'BPMN 2.0',
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'core', name: 'Core', stencils: [] },
      { id: 'collaboration', name: 'Collaboration', stencils: [] },
      { id: 'process', name: 'Process', stencils: [] },
      { id: 'choreography', name: 'Choreography', stencils: [] }
    ]
  };

  addStencil(bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-task',
    name: 'Task',
    subPackage: 'process',
    aspectRatio: 1.5,
    texts: {
      text: 'Task'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnActivity',
            data: {
              activityType: 'task'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            radius: 10
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-sub-process',
    name: 'Sub-process',
    subPackage: 'process',
    aspectRatio: 1.5,
    texts: {
      text: 'Sub-process'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnActivity',
            data: {
              activityType: 'sub-process'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            radius: 10
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-event-sub-process',
    name: 'Event sub-process',
    subPackage: 'process',
    aspectRatio: 1.5,
    texts: {
      text: 'Event sub-process'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnActivity',
            data: {
              activityType: 'event-sub-process'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            radius: 10
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-transaction',
    name: 'Transaction',
    subPackage: 'process',
    aspectRatio: 1.5,
    texts: {
      text: 'Transaction'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnActivity',
            data: {
              activityType: 'transaction'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            radius: 10
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNDataStoreNodeDefinition(), {
    id: 'bpmn-data-store',
    name: 'Data Store',
    subPackage: 'process',
    size: {
      w: 70,
      h: 70
    },
    texts: {
      text: 'Data Store'
    }
  });

  addStencil(bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-object',
    name: 'Data Object',
    subPackage: 'process',
    size: {
      w: 35,
      h: 50
    },
    texts: {
      text: 'Data'
    },
    props: () => {
      return {
        text: {
          valign: 'top'
        }
      };
    }
  });
  addStencil(bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-objects',
    name: 'Data Objects',
    subPackage: 'process',
    size: {
      w: 35,
      h: 50
    },
    texts: {
      text: 'Data'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnDataObject',
            data: {
              collection: true
            }
          }
        ]
      }
    },
    props: () => {
      return {
        text: {
          valign: 'top'
        }
      };
    }
  });
  addStencil(bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-input',
    name: 'Data Input',
    subPackage: 'process',
    size: {
      w: 35,
      h: 50
    },
    texts: {
      text: 'Data Input'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnDataObject',
            data: {
              type: 'input'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        text: {
          valign: 'top'
        }
      };
    }
  });
  addStencil(bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-output',
    name: 'Data Output',
    subPackage: 'process',
    size: {
      w: 35,
      h: 50
    },
    texts: {
      text: 'Data Output'
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnDataObject',
            data: {
              type: 'output'
            }
          }
        ]
      }
    },
    props: () => {
      return {
        text: {
          valign: 'top'
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-start',
    name: 'Start Event',
    subPackage: 'process',
    size: {
      w: 30,
      h: 30
    },
    texts: {
      text: ''
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnEvent',
            data: {
              eventType: 'start'
            }
          }
        ]
      }
    }
  });

  addStencil(bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-intermediate',
    name: 'Intermediate Event',
    subPackage: 'process',
    size: {
      w: 30,
      h: 30
    },
    texts: {
      text: ''
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnEvent',
            data: {
              eventType: 'intermediate'
            }
          }
        ]
      }
    }
  });

  addStencil(bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-end',
    name: 'End Event',
    subPackage: 'process',
    size: {
      w: 30,
      h: 30
    },
    texts: {
      text: ''
    },
    metadata: {
      data: {
        data: [
          {
            type: 'schema',
            enabled: true,
            schema: 'bpmnEvent',
            data: {
              eventType: 'end'
            }
          }
        ]
      }
    }
  });

  addStencil(bpmnStencils, new BPMNGatewayNodeDefinition(), {
    id: 'bpmn-gateway',
    name: 'Gateway',
    subPackage: 'process',
    size: {
      w: 30,
      h: 30
    },
    texts: {
      text: '%name%'
    },
    props: () => {
      return {
        text: {
          valign: 'top'
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNConversationNodeDefinition(), {
    id: 'bpmn-conversation',
    name: 'Conversation',
    subPackage: 'collaboration',
    size: {
      w: 40,
      h: 40
    },
    texts: {
      text: 'Conversation'
    }
  });

  addStencil(bpmnStencils, new BPMNAnnotationNodeDefinition(), {
    id: 'bpmn-annotation',
    name: 'Annotation',
    subPackage: 'core',
    size: {
      w: 100,
      h: 40
    },
    texts: {
      text: 'Annotation'
    },
    props: () => ({
      fill: {
        enabled: false
      },
      text: {
        align: 'left',
        left: 12
      }
    })
  });

  addStencil(bpmnStencils, new RoundedRectNodeDefinition(), {
    id: 'bpmn-group',
    name: 'Group',
    subPackage: 'core',
    size: {
      w: 300,
      h: 200
    },
    texts: {
      text: 'Group'
    },
    props: () => ({
      stroke: {
        pattern: 'DASH_DOT',
        patternSpacing: 50,
        patternSize: 70
      },
      custom: {
        roundedRect: {
          radius: 10
        }
      },
      text: {
        valign: 'top',
        align: 'right',
        top: 8,
        right: 8
      }
    })
  });

  addStencil(bpmnStencils, new BPMNChoreographyActivityNodeDefinition(), {
    id: 'bpmn-choreography',
    name: 'Choreography',
    subPackage: 'choreography',
    size: {
      w: 100,
      h: 100
    }
  });

  addStencil(bpmnStencils, new BPMNChoreographyActivityParticipantNodeDefinition(), {
    id: 'bpmn-choreography-participant',
    name: 'Choreography Participant',
    subPackage: 'choreography',
    size: {
      w: 100,
      h: 30
    },
    texts: {
      text: 'Participant'
    }
  });

  addStencil(bpmnStencils, new BPMNChoreographyActivityNameNodeDefinition(), {
    id: 'bpmn-choreography-name',
    name: 'Choreography Activity Name',
    subPackage: 'choreography',
    size: {
      w: 100,
      h: 30
    },
    texts: {
      text: 'Task'
    }
  });

  addStencil(bpmnStencils, new BPMNChoreographyEnvelopeNodeDefinition(), {
    id: 'bpmn-choreography-envelope',
    name: 'Choreography Envelope',
    subPackage: 'choreography',
    size: {
      w: 40,
      h: 20
    }
  });

  addStencil(bpmnStencils, new BPMNLane(), {
    id: 'bpmn-vertical-lane',
    name: 'Vertical Lane',
    subPackage: 'collaboration',
    size: {
      w: 100,
      h: 400
    },
    texts: {
      text: 'Lane'
    },
    props: () => {
      return {
        custom: {
          swimlane: {
            title: true
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNLane(), {
    id: 'bpmn-horizonal-lane',
    name: 'Horizontal Lane',
    subPackage: 'collaboration',
    size: {
      w: 400,
      h: 100
    },
    texts: {
      text: 'Lane'
    },
    props: () => {
      return {
        custom: {
          swimlane: {
            title: true,
            orientation: 'horizontal'
          }
        }
      };
    }
  });
  addStencil(bpmnStencils, new BPMNLane(), {
    id: 'bpmn-vertical-pool',
    name: 'Vertical Pool',
    subPackage: 'collaboration',
    size: {
      w: 200,
      h: 400
    },
    texts: {
      text: 'Pool'
    },
    props: () => {
      return {
        custom: {
          swimlane: {
            title: true
          }
        },
        layout: {
          container: {
            enabled: true,
            autoShrink: true,
            direction: 'horizontal',
            alignItems: 'stretch'
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNLane(), {
    id: 'bpmn-horizonal-pool',
    name: 'Horizontal Pool',
    subPackage: 'collaboration',
    size: {
      w: 400,
      h: 200
    },
    texts: {
      text: 'Pool'
    },
    props: () => {
      return {
        custom: {
          swimlane: {
            title: true,
            orientation: 'horizontal'
          }
        },
        layout: {
          container: {
            enabled: true,
            autoShrink: true,
            direction: 'vertical',
            alignItems: 'stretch'
          }
        }
      };
    }
  });

  addStencil(bpmnStencils, new BPMNConversationEdgeDefinition(), {
    id: 'bpmn-conversation-edge',
    name: 'Conversation Edge',
    subPackage: 'collaboration',
    size: {
      w: 10,
      h: 10
    }
  });

  loadStencilsFromYaml(stencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'choreography')?.stencils.push(s);
  });

  registry.stencils.register(bpmnStencils, true);
};
