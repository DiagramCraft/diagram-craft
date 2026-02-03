import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import chenStencils from './chen/chen-stencils.yaml';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';

export const registerDataModellingNodes = async (_nodes: NodeDefinitionRegistry) => {};

export const registerDataModellingEdges = async (_edges: EdgeDefinitionRegistry) => {};

export const registerDataModellingStencils = async (registry: Registry) => {
  await registerDataModellingNodes(registry.nodes);
  await registerDataModellingEdges(registry.edges);

  const dataModellingStencils: StencilPackage = {
    id: 'data-modelling',
    name: 'Data Modelling',
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'chen', name: "Chen's notation", stencils: [] },
      { id: 'ie', name: 'Information Engineering', stencils: [] },
      { id: 'barker', name: 'Barker notation', stencils: [] }
    ]
  };

  loadStencilsFromYaml(chenStencils).forEach(s => {
    dataModellingStencils.stencils.push(s);
    dataModellingStencils.subPackages!.find(p => p.id === 'chen')?.stencils.push(s);
  });

  registry.stencils.register(dataModellingStencils, true);
};
