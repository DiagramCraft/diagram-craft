import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import chenStencils from './chen/chen-stencils.yaml';
import ieStencils from './ie/ie-stencils.yaml';
import barkerStencils from './barker/barker-stencils.yaml';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import { IEEntityTextNodeDefinition } from '@diagram-craft/stencil-data-modelling/ie/IEEntityText.nodeType';
import { IEEntityNodeDefinition } from '@diagram-craft/stencil-data-modelling/ie/IEEntity.nodeType';
import { BarkerEntityTextNodeDefinition } from '@diagram-craft/stencil-data-modelling/barker/BarkerEntityText.nodeType';
import { BarkerEntityNodeDefinition } from '@diagram-craft/stencil-data-modelling/barker/BarkerEntity.nodeType';

export const registerDataModellingNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new IEEntityTextNodeDefinition());
  nodes.register(new IEEntityNodeDefinition());
  nodes.register(new BarkerEntityNodeDefinition());
  nodes.register(new BarkerEntityTextNodeDefinition());
};

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
      { id: 'ie', name: 'Information engineering notation', stencils: [] },
      { id: 'barker', name: 'Barker notation', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* CHEN PACKAGE                                                            */
  /* *********************************************************************** */

  loadStencilsFromYaml(chenStencils).forEach(s => {
    dataModellingStencils.stencils.push(s);
    dataModellingStencils.subPackages!.find(p => p.id === 'chen')?.stencils.push(s);
  });

  registry.stencils.register(dataModellingStencils, true);

  /* *********************************************************************** */
  /* IE PACKAGE                                                              */
  /* *********************************************************************** */

  loadStencilsFromYaml(ieStencils).forEach(s => {
    dataModellingStencils.stencils.push(s);
    dataModellingStencils.subPackages!.find(p => p.id === 'ie')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* BARKER PACKAGE                                                          */
  /* *********************************************************************** */

  loadStencilsFromYaml(barkerStencils).forEach(s => {
    dataModellingStencils.stencils.push(s);
    dataModellingStencils.subPackages!.find(p => p.id === 'barker')?.stencils.push(s);
  });
};
