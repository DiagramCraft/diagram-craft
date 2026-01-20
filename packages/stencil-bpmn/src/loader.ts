import {
  NodeDefinitionRegistry,
  registerStencil,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { BPMNActivityNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNActivity.nodeType';

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

  r.stencilRegistry.register(bpmnStencils, true);
};
