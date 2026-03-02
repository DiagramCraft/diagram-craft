import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';

export const registerUMLNodes = async (_nodes: NodeDefinitionRegistry) => {};

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLNodes(registry.nodes);

  const umlStencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [{ id: 'class', name: 'Class Diagrams', stencils: [] }]
  };

  /* *********************************************************************** */
  /* CLASS PACKAGE                                                           */
  /* *********************************************************************** */

  /*loadStencilsFromYaml(c4CoreStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'core')?.stencils.push(s);
  });*/

  return umlStencils;
};
