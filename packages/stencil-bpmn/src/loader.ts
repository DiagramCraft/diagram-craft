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
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            activityType: 'task',
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
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            activityType: 'sub-process',
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
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            activityType: 'event-sub-process',
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
    props: () => {
      return {
        custom: {
          bpmnActivity: {
            activityType: 'transaction',
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
    props: () => {
      return {
        text: {
          valign: 'top'
        },
        custom: {
          bpmnDataObject: {
            collection: true
          }
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
    props: () => {
      return {
        text: {
          valign: 'top'
        },
        custom: {
          bpmnDataObject: {
            type: 'input'
          }
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
    props: () => {
      return {
        text: {
          valign: 'top'
        },
        custom: {
          bpmnDataObject: {
            type: 'output'
          }
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
    props: () => {
      return {
        custom: {
          bpmnEvent: {
            eventType: 'start'
          }
        }
      };
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
    props: () => {
      return {
        custom: {
          bpmnEvent: {
            eventType: 'intermediate'
          }
        }
      };
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
    props: () => {
      return {
        custom: {
          bpmnEvent: {
            eventType: 'end'
          }
        }
      };
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
      text: ''
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

  r.stencilRegistry.register(bpmnStencils, true);
};
