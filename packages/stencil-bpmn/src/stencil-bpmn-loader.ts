import {
  NodeDefinitionRegistry,
  registerStencil,
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
import { BPMNChoreographyTaskNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyTask.nodeType';
import { BPMNChoreographyTaskParticipantNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyTaskParticipant.nodeType';
import { BPMNChoreographyEnvelopeNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyEnvelope.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import stencils from './bpmnStencils.yaml';
import { BPMNLane } from '@diagram-craft/stencil-bpmn/BPMNLane';

export const registerBPMNShapes = async (r: NodeDefinitionRegistry) => {
  const bpmnStencils: StencilPackage = {
    id: 'bpmn2',
    name: 'BPMN 2.0',
    stencils: [],
    type: 'default'
  };

  registerStencil(r, bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-task',
    name: 'Task',
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

  registerStencil(r, bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-sub-process',
    name: 'Sub-process',
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

  registerStencil(r, bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-event-sub-process',
    name: 'Event sub-process',
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

  registerStencil(r, bpmnStencils, new BPMNActivityNodeDefinition(), {
    id: 'bpmn-activity-transaction',
    name: 'Transaction',
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

  registerStencil(r, bpmnStencils, new BPMNDataStoreNodeDefinition(), {
    id: 'bpmn-data-store',
    name: 'Data Store',
    size: {
      w: 70,
      h: 70
    },
    texts: {
      text: 'Data Store'
    }
  });

  registerStencil(r, bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-object',
    name: 'Data Object',
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
  registerStencil(r, bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-objects',
    name: 'Data Objects',
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
  registerStencil(r, bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-input',
    name: 'Data Input',
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
  registerStencil(r, bpmnStencils, new BPMNDataObjectNodeType(), {
    id: 'bpmn-data-output',
    name: 'Data Output',
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

  registerStencil(r, bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-start',
    name: 'Start Event',
    size: {
      w: 40,
      h: 40
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

  registerStencil(r, bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-intermediate',
    name: 'Intermediate Event',
    size: {
      w: 40,
      h: 40
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

  registerStencil(r, bpmnStencils, new BPMNEventNodeDefinition(), {
    id: 'bpmn-event-end',
    name: 'End Event',
    size: {
      w: 40,
      h: 40
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

  registerStencil(r, bpmnStencils, new BPMNGatewayNodeDefinition(), {
    id: 'bpmn-gateway',
    name: 'Gateway',
    size: {
      w: 50,
      h: 50
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

  registerStencil(r, bpmnStencils, new BPMNConversationNodeDefinition(), {
    id: 'bpmn-conversation',
    name: 'Conversation',
    size: {
      w: 40,
      h: 40
    },
    texts: {
      text: 'Conversation'
    }
  });

  registerStencil(r, bpmnStencils, new BPMNAnnotationNodeDefinition(), {
    id: 'bpmn-annotation',
    name: 'Annotation',
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

  registerStencil(r, bpmnStencils, new RoundedRectNodeDefinition(), {
    id: 'bpmn-group',
    name: 'Group',
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

  registerStencil(r, bpmnStencils, new BPMNChoreographyTaskNodeDefinition(), {
    id: 'bpmn-choreography',
    name: 'Choreography',
    size: {
      w: 100,
      h: 100
    }
  });

  registerStencil(r, bpmnStencils, new BPMNChoreographyTaskParticipantNodeDefinition(), {
    id: 'bpmn-choreography-participant',
    name: 'Choreography Participant',
    size: {
      w: 100,
      h: 30
    },
    texts: {
      text: 'Participant'
    }
  });

  registerStencil(r, bpmnStencils, new BPMNChoreographyEnvelopeNodeDefinition(), {
    id: 'bpmn-choreography-envelope',
    name: 'Choreography Envelope',
    size: {
      w: 40,
      h: 20
    }
  });

  registerStencil(r, bpmnStencils, new BPMNLane(), {
    id: 'bpmn-vertical-lane',
    name: 'Vertical Lane',
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

  registerStencil(r, bpmnStencils, new BPMNLane(), {
    id: 'bpmn-horizonal-lane',
    name: 'Horizontal Lane',
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
  registerStencil(r, bpmnStencils, new BPMNLane(), {
    id: 'bpmn-vertical-pool',
    name: 'Vertical Pool',
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

  registerStencil(r, bpmnStencils, new BPMNLane(), {
    id: 'bpmn-horizonal-pool',
    name: 'Horizontal Pool',
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

  bpmnStencils.stencils.push(...loadStencilsFromYaml(stencils));

  r.stencilRegistry.register(bpmnStencils, true);
};
