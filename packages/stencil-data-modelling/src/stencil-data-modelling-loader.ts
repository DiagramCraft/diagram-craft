import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry
} from '@diagram-craft/model/elementDefinitionRegistry';
import chenStencils from './chen/chen-stencils.yaml';
import ieStencils from './ie/ie-stencils.yaml';
import barkerStencils from './barker/barker-stencils.yaml';
import idef1xStencils from './idef1x/idef1x-stencils.yaml';
import { YamlStencilLoader } from '@diagram-craft/model/elementDefinitionLoader';
import { IEEntityTextNodeDefinition } from '@diagram-craft/stencil-data-modelling/ie/IEEntityText.nodeType';
import { IEEntityNodeDefinition } from '@diagram-craft/stencil-data-modelling/ie/IEEntity.nodeType';
import { BarkerEntityTextNodeDefinition } from '@diagram-craft/stencil-data-modelling/barker/BarkerEntityText.nodeType';
import { BarkerEntityNodeDefinition } from '@diagram-craft/stencil-data-modelling/barker/BarkerEntity.nodeType';
import { IDEF1XEntityNodeDefinition } from '@diagram-craft/stencil-data-modelling/idef1x/IDEF1XEntity.nodeType';
import { IDEF1XCategoryDiscriminatorNodeDefinition } from '@diagram-craft/stencil-data-modelling/idef1x/IDEF1XCategoryDiscriminator.nodeType';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';

export const registerDataModellingNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new IEEntityTextNodeDefinition());
  nodes.register(new IEEntityNodeDefinition());
  nodes.register(new BarkerEntityNodeDefinition());
  nodes.register(new BarkerEntityTextNodeDefinition());
  nodes.register(new IDEF1XEntityNodeDefinition());
  nodes.register(new IDEF1XCategoryDiscriminatorNodeDefinition());
};

export const registerDataModellingEdges = async (_edges: EdgeDefinitionRegistry) => {};

export const loadDataModellingStencils = async (registry: Registry) => {
  await registerDataModellingNodes(registry.nodes);
  await registerDataModellingEdges(registry.edges);

  const dataModellingStencils: StencilPackage = {
    id: 'data-modelling',
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'chen', name: "Chen's notation", stencils: [] },
      { id: 'ie', name: 'Information engineering notation', stencils: [] },
      { id: 'barker', name: 'Barker notation', stencils: [] },
      { id: 'idef1x', name: 'IDEF1X notation', stencils: [] }
    ]
  };
  const loader = new YamlStencilLoader(dataModellingStencils);

  /* *********************************************************************** */
  /* CHEN PACKAGE                                                            */
  /* *********************************************************************** */

  loader.registerSubPackage('chen', chenStencils);

  /* *********************************************************************** */
  /* IE PACKAGE                                                              */
  /* *********************************************************************** */

  loader.registerSubPackage('ie', ieStencils);

  /* *********************************************************************** */
  /* BARKER PACKAGE                                                          */
  /* *********************************************************************** */

  loader.registerSubPackage('barker', barkerStencils);

  /* *********************************************************************** */
  /* IDEF1X PACKAGE                                                          */
  /* *********************************************************************** */

  loader.registerSubPackage('idef1x', idef1xStencils);

  return loader.apply();
};
