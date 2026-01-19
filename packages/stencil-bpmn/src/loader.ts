import {
  NodeDefinitionRegistry,
  registerStencil,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { BPMNTaskNodeDefinition } from '@diagram-craft/stencil-bpmn/BPMNTask.nodeType';

export const registerBPMNShapes = async (r: NodeDefinitionRegistry) => {
  const bpmnStencils: StencilPackage = {
    id: 'bpmn2',
    name: 'BPMN 2.0',
    stencils: [],
    type: 'default'
  };

  registerStencil(r, bpmnStencils, new BPMNTaskNodeDefinition(), {
    aspectRatio: 1.5,
    props: () => {
      return {
        custom: {
          bpmnTask: {
            radius: 10
          }
        }
      };
    }
  });

  r.stencilRegistry.register(bpmnStencils, true);
};
