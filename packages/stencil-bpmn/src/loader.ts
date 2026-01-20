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
    aspectRatio: 1.5,
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

  r.stencilRegistry.register(bpmnStencils, true);
};
