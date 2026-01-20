import {
  NodeDefinitionRegistry,
  registerStencil,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { BPMNActivityNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNActivity.nodeType';
import { BPMNDataObjectNodeType } from '@diagram-craft/stencil-bpmn/BPMNDataObject.nodeType';

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

  r.stencilRegistry.register(bpmnStencils, true);
};
