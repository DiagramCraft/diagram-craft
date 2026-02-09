import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import c4CoreStencils from './c4-core-stencils.yaml';

export const registerC4Nodes = async (_nodes: NodeDefinitionRegistry) => {};

export const registerC4Edges = async (_edges: EdgeDefinitionRegistry) => {};

export const loadC4Stencils = async (_registry: Registry) => {
  const c4Stencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'core', name: 'Core', stencils: [] },
      { id: 'old', name: 'Old Style', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* CORE PACKAGE                                                            */
  /* *********************************************************************** */

  loadStencilsFromYaml(c4CoreStencils).forEach(s => {
    c4Stencils.stencils.push(s);
    c4Stencils.subPackages!.find(p => p.id === 'core')?.stencils.push(s);
  });

  return c4Stencils;
};
