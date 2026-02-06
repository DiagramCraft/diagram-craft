import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry
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
import bpmnChoreographyStencils from './bpmn-choreography-stencils.yaml';
import bpmnChoreographyAdvancedStencils from './bpmn-choreography-advanced-stencils.yaml';
import bpmnEdgesStencils from './bpmn-edges-stencils.yaml';
import bpmnCoreStencils from './bpmn-core-stencils.yaml';
import bpmnCollaborationStencils from './bpmn-collaboration-stencils.yaml';
import { BPMNLane } from '@diagram-craft/stencil-bpmn/BPMNLane';
import { BPMNChoreographyActivityNameNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNChoreographyActivityName.nodeType';
import { BPMNConversationEdgeDefinition } from '@diagram-craft/stencil-bpmn/BPMNConversationEdge.edgeType';
import { addStencilToSubpackage, StencilPackage } from '@diagram-craft/model/stencilRegistry';

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

export const loadBPMNStencils = async (registry: Registry) => {
  await registerBPMNNodes(registry.nodes);
  await registerBPMNEdges(registry.edges);

  const bpmnStencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'core', name: 'Core', stencils: [] },
      { id: 'edges', name: 'Edges', stencils: [] },
      { id: 'collaboration', name: 'Collaboration', stencils: [] },
      { id: 'process', name: 'Process', stencils: [] },
      { id: 'choreography', name: 'Choreography', stencils: [] },
      { id: 'choreography-advanced', name: 'Choreography (Advanced)', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* CORE PACKAGE                                                            */
  /* *********************************************************************** */

  loadStencilsFromYaml(bpmnCoreStencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'core')?.stencils.push(s);
  });

  addStencilToSubpackage('core', bpmnStencils, new RoundedRectNodeDefinition(), {
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

  /* *********************************************************************** */
  /* EDGES PACKAGE                                                           */
  /* *********************************************************************** */

  loadStencilsFromYaml(bpmnEdgesStencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'edges')?.stencils.push(s);
  });

  addStencilToSubpackage('edges', bpmnStencils, new BPMNConversationEdgeDefinition(), {
    id: 'bpmn-conversation-edge',
    name: 'Conversation Edge',
    size: {
      w: 10,
      h: 10
    }
  });

  /* *********************************************************************** */
  /* COLLABORATION PACKAGE                                                   */
  /* *********************************************************************** */

  addStencilToSubpackage('collaboration', bpmnStencils, new BPMNLane(), {
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

  addStencilToSubpackage('collaboration', bpmnStencils, new BPMNLane(), {
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

  addStencilToSubpackage('collaboration', bpmnStencils, new BPMNLane(), {
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

  addStencilToSubpackage('collaboration', bpmnStencils, new BPMNLane(), {
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

  addStencilToSubpackage('collaboration', bpmnStencils, new BPMNConversationNodeDefinition(), {
    id: 'bpmn-conversation',
    name: 'Conversation',
    size: {
      w: 40,
      h: 40
    },
    props: () => {
      return {
        text: {
          position: 's',
          valign: 'top',
          top: 8
        }
      };
    }
  });

  loadStencilsFromYaml(bpmnCollaborationStencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'collaboration')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* PROCESS PACKAGE                                                         */
  /* *********************************************************************** */

  addStencilToSubpackage('process', bpmnStencils, new BPMNActivityNodeDefinition(), {
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

  addStencilToSubpackage('process', bpmnStencils, new BPMNActivityNodeDefinition(), {
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

  addStencilToSubpackage('process', bpmnStencils, new BPMNActivityNodeDefinition(), {
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

  addStencilToSubpackage('process', bpmnStencils, new BPMNActivityNodeDefinition(), {
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

  addStencilToSubpackage('process', bpmnStencils, new BPMNDataStoreNodeDefinition(), {
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

  addStencilToSubpackage('process', bpmnStencils, new BPMNDataObjectNodeType(), {
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
          valign: 'top',
          top: 8,
          position: 's'
        }
      };
    }
  });

  addStencilToSubpackage('process', bpmnStencils, new BPMNDataObjectNodeType(), {
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
          valign: 'top',
          top: 8,
          position: 's'
        }
      };
    }
  });

  addStencilToSubpackage('process', bpmnStencils, new BPMNDataObjectNodeType(), {
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
          valign: 'top',
          top: 8,
          position: 's'
        }
      };
    }
  });

  addStencilToSubpackage('process', bpmnStencils, new BPMNDataObjectNodeType(), {
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
          valign: 'top',
          top: 8,
          position: 's'
        }
      };
    }
  });

  for (const type of ['start', 'intermediate', 'end']) {
    addStencilToSubpackage('process', bpmnStencils, new BPMNEventNodeDefinition(), {
      id: `bpmn-event-${type}`,
      name: `${type[0]!.toUpperCase()}${type.slice(1)} Event`,
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
                eventType: type
              }
            }
          ]
        }
      }
    });
  }

  for (const { value, label } of [
    { value: 'default', label: 'Default' },
    { value: 'exclusive', label: 'Exclusive' },
    { value: 'inclusive', label: 'Inclusive' },
    { value: 'parallel', label: 'Parallel' },
    { value: 'complex', label: 'Complex' },
    { value: 'event-based', label: 'Event Based' },
    {
      value: 'event-based-start-process-inclusive',
      label: 'Event Based Start Process Inclusive'
    }
  ]) {
    addStencilToSubpackage('process', bpmnStencils, new BPMNGatewayNodeDefinition(), {
      id: `bpmn-gateway-${value}`,
      name: `Gateway ${label}`,
      size: {
        w: 30,
        h: 30
      },
      texts: {
        text: '%name%'
      },
      metadata: {
        data: {
          data: [
            {
              type: 'schema',
              enabled: true,
              schema: 'bpmnGateway',
              data: {
                type: value
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
  }

  /* *********************************************************************** */
  /* CHOREOGRAPHY PACKAGE                                                    */
  /* *********************************************************************** */

  loadStencilsFromYaml(bpmnChoreographyStencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'choreography')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* CHOREOGRAPHY ADVANCED PACKAGE                                           */
  /* *********************************************************************** */

  loadStencilsFromYaml(bpmnChoreographyAdvancedStencils).forEach(s => {
    bpmnStencils.stencils.push(s);
    bpmnStencils.subPackages!.find(p => p.id === 'choreography-advanced')?.stencils.push(s);
  });

  addStencilToSubpackage(
    'choreography-advanced',
    bpmnStencils,
    new BPMNChoreographyActivityNodeDefinition(),
    {
      id: 'bpmn-choreography',
      name: 'Choreography',
      size: {
        w: 100,
        h: 100
      }
    }
  );

  addStencilToSubpackage(
    'choreography-advanced',
    bpmnStencils,
    new BPMNChoreographyActivityParticipantNodeDefinition(),
    {
      id: 'bpmn-choreography-participant',
      name: 'Choreography Participant',
      size: {
        w: 100,
        h: 30
      },
      texts: {
        text: 'Participant'
      }
    }
  );

  addStencilToSubpackage(
    'choreography-advanced',
    bpmnStencils,
    new BPMNChoreographyActivityNameNodeDefinition(),
    {
      id: 'bpmn-choreography-name',
      name: 'Choreography Activity Name',
      size: {
        w: 100,
        h: 30
      },
      texts: {
        text: 'Task'
      }
    }
  );

  addStencilToSubpackage(
    'choreography-advanced',
    bpmnStencils,
    new BPMNChoreographyEnvelopeNodeDefinition(),
    {
      id: 'bpmn-choreography-envelope',
      name: 'Choreography Envelope',
      size: {
        w: 40,
        h: 20
      }
    }
  );

  return bpmnStencils;
};
